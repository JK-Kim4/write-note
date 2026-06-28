package com.writenote.service

import com.writenote.components.documents.ProseMirrorText
import com.writenote.crypto.BodyCipherService
import com.writenote.entity.Category
import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.error.BodyDecryptionException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectCardResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.BoardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class ProjectService(
    private val projectRepository: ProjectRepository,
    private val userRepository: UserRepository,
    private val projectMapper: ProjectMapper,
    private val documentRepository: DocumentRepository,
    private val workSessionRepository: WorkSessionRepository,
    private val categoryRepository: CategoryRepository,
    private val bodyCipherService: BodyCipherService,
    private val boardRepository: BoardRepository,
    private val shareLinkRepository: ShareLinkRepository,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun createProject(
        userId: Long,
        request: CreateProjectRequest,
    ): ProjectResponse {
        requireExistingUser(userId)
        val project =
            projectRepository.save(
                Project(
                    userId = userId,
                    title = request.title.trim(),
                    targetLength = request.targetLength,
                    // 장르·줄거리·톤류는 시리즈로 이동(033 R3) — 작품 생성 시 미반영(엔티티 기본값 유지, 컬럼 보존)
                    paperSize = validatedPaperSize(request.paperSize),
                    layoutMode = validatedLayoutMode(request.layoutMode),
                    fontScale = validatedFontScale(request.fontScale),
                ),
            )
        documentRepository.save(Document(projectId = requireNotNull(project.id), sortOrder = 0))
        return toResponse(project)
    }

    @Transactional(readOnly = true)
    fun listProjects(
        userId: Long,
        page: Int,
        size: Int,
        archived: Boolean,
    ): PageResponse<ProjectResponse> {
        requireExistingUser(userId)
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }

        val pageable = PageRequest.of(page, size)
        val projects =
            if (archived) {
                projectRepository.findByUserIdAndArchivedAtIsNotNullOrderByArchivedAtDesc(userId, pageable)
            } else {
                projectRepository.findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(userId, pageable)
            }

        val categoryById = categoriesByProjects(projects.content)
        return PageResponse.from(
            projects.map { project -> projectMapper.toResponse(project, categoryById[project.categoryId]) },
        )
    }

    /**
     * 카드 집계(018) — 활성 작품 전량 + 문서 글자수·저장 시각·누적 작업시간(종료 세션 합).
     * 3쿼리 일괄(작품/문서 IN/세션 IN) 후 projectId 그룹 조립 — 작품 수와 무관(SQL N+1 금지).
     */
    @Transactional(readOnly = true)
    fun listCards(userId: Long): List<ProjectCardResponse> {
        requireExistingUser(userId)
        val projects = projectRepository.findByUserIdAndArchivedAtIsNull(userId)
        if (projects.isEmpty()) {
            return emptyList()
        }

        val projectIds = projects.map { requireNotNull(it.id) }
        // 소속 시리즈 일괄 조회 — projectId 마다 개별 조회 금지 (effective 해석용, N+1 금지)
        val categoryById = categoriesByProjects(projects)
        // 활성 챕터 전량 일괄 조회 — groupBy 로 projectId 별 그룹 조립 (N+1 금지)
        val chaptersByProjectId =
            documentRepository.findByProjectIdInAndDeletedAtIsNull(projectIds).groupBy { it.projectId }
        val durationByProjectId =
            workSessionRepository
                .findByProjectIdInAndEndedAtIsNotNull(projectIds)
                .groupBy { it.projectId }
                .mapValues { (_, sessions) ->
                    sessions.sumOf {
                        requireNotNull(it.endedAt).toEpochMilli() - requireNotNull(it.startedAt).toEpochMilli()
                    }
                }

        return projects.map { project ->
            val projectId = requireNotNull(project.id)
            val chapters = chaptersByProjectId[projectId] ?: emptyList()
            // INV-1: 활성 작품은 항상 활성 챕터 ≥ 1 이나 방어적으로 빈 그룹 허용 (wordCount 0)
            val wordCount = chapters.sumOf { it.wordCount }
            val latestChapter = chapters.maxByOrNull { it.updatedAt ?: Instant.EPOCH }
            val documentUpdatedAt =
                latestChapter?.updatedAt
                    ?: requireNotNull(project.updatedAt) // 챕터 없는 경우 작품 수정 시각 fallback
            // 최근 수정 챕터 body 의 plainText — 암호문이면 복호 후 추출(레거시 평문은 통과) (T022)
            // 미리보기 복호 실패는 목록 전체를 막지 않는다(graceful) — 손상/키부재 본문 1건이 작품 목록
            // 전체를 500 으로 떨어뜨리지 않도록 빈 미리보기로 흡수한다. 본문 열기(getDocument)는 fail-closed 유지.
            val lastSentenceSource =
                latestChapter?.let {
                    try {
                        ProseMirrorText.extractPlainText(bodyCipherService.decryptToPlain(userId, it.body))
                    } catch (e: BodyDecryptionException) {
                        ""
                    }
                } ?: ""
            ProjectCardResponse.from(
                base = projectMapper.toResponse(project, categoryById[project.categoryId]),
                categoryName = categoryById[project.categoryId]?.name,
                wordCount = wordCount,
                documentUpdatedAt = documentUpdatedAt,
                totalDurationMs = durationByProjectId[projectId] ?: 0L,
                lastSentenceSource = lastSentenceSource,
            )
        }
    }

    @Transactional(readOnly = true)
    fun getProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse =
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .map { toResponse(it) }
            .orElseThrow { ResourceNotFoundException("Project not found") }

    @Transactional(rollbackFor = [Exception::class])
    fun updateProject(
        userId: Long,
        projectId: Long,
        request: UpdateProjectRequest,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)

        request.title?.let { project.title = it.trim() }
        request.targetLength?.let { project.targetLength = it }
        // 장르·줄거리·톤류는 시리즈로 이동(033 R3) — 변경 경로 제거(기존 컬럼·값 보존, FR-014)
        request.paperSize?.let { project.paperSize = validatedPaperSize(it) }
        request.layoutMode?.let { project.layoutMode = validatedLayoutMode(it) }
        request.fontScale?.let { project.fontScale = validatedFontScale(it) }

        return toResponse(project)
    }

    /** 용지 크기 허용값 검증 — null 이면 기본 'A4', 비허용값이면 [ValidationException]. */
    private fun validatedPaperSize(value: String?): String {
        if (value == null) return "A4"
        if (value !in ALLOWED_PAPER_SIZES) {
            throw ValidationException("지원하지 않는 용지 크기입니다: $value")
        }
        return value
    }

    /** 출판 방식 허용값 검증(031) — null 이면 기본 'paper', 비허용값이면 [ValidationException]. */
    private fun validatedLayoutMode(value: String?): String {
        if (value == null) return "paper"
        if (value !in ALLOWED_LAYOUT_MODES) {
            throw ValidationException("지원하지 않는 출판 방식입니다: $value")
        }
        return value
    }

    /** 글자 크기 5단 검증(031 US5) — null 이면 기본 'm'(보통=판형 기본), 비허용값이면 [ValidationException]. */
    private fun validatedFontScale(value: String?): String {
        if (value == null) return "m"
        if (value !in ALLOWED_FONT_SCALES) {
            throw ValidationException("지원하지 않는 글자 크기입니다: $value")
        }
        return value
    }

    /**
     * 작품을 모음으로 이동(032) — [categoryId] null = 미분류로 빼냄.
     * 본인 작품·모음만(아니면 404). 기존 PATCH 와 별도(null-vs-absent 모호 회피).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun moveCategory(
        userId: Long,
        projectId: Long,
        categoryId: Long?,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        if (categoryId != null && !categoryRepository.existsByIdAndUserId(categoryId, userId)) {
            throw ResourceNotFoundException("Category not found")
        }
        project.categoryId = categoryId
        return toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun archiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.archive(Instant.now())
        return toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun unarchiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.unarchive()
        return toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteProject(
        userId: Long,
        projectId: Long,
    ) {
        val project = requireOwnedProject(userId, projectId)
        // 이 작품에 소속된 플롯 보드(041)는 아이디어 보드로 강등(보드 보존). 다형이라 DB FK SET NULL 불가 → 앱 처리.
        boardRepository.clearOwner("project", projectId)
        // 이 작품의 공유 링크(046)는 비활성(스냅샷·댓글은 보존 — 피드백 이력 유지, R-5/FR-025).
        shareLinkRepository.deactivateByTarget("work", projectId)
        projectRepository.delete(project)
    }

    /** 단건 작품 → 응답 (effective 해석 포함). 소속 시리즈 1건만 조회. */
    private fun toResponse(project: Project): ProjectResponse {
        val category = project.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return projectMapper.toResponse(project, category)
    }

    /** 다수 작품의 소속 시리즈를 일괄 조회해 id→Category map 으로 반환 (effective 해석용, N+1 금지). */
    private fun categoriesByProjects(projects: List<Project>): Map<Long, Category> {
        val categoryIds = projects.mapNotNull { it.categoryId }.distinct()
        if (categoryIds.isEmpty()) {
            return emptyMap()
        }
        return categoryRepository.findAllById(categoryIds).associateBy { requireNotNull(it.id) }
    }

    fun requireOwnedProject(
        userId: Long,
        projectId: Long,
    ): Project =
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ResourceNotFoundException("Project not found") }

    private fun requireExistingUser(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw ResourceNotFoundException("User not found")
        }
    }

    companion object {
        private val ALLOWED_PAPER_SIZES = setOf("A4", "A3", "A2", "B4", "sinkukpan", "kukpan", "pan46", "mungopan")
        private val ALLOWED_LAYOUT_MODES = setOf("paper", "web")
        private val ALLOWED_FONT_SCALES = setOf("xs", "s", "m", "l", "xl")
    }
}
