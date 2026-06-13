package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectCardResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
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
                    genre = request.genre,
                    targetLength = request.targetLength,
                    toneNotes = request.toneNotes,
                    synopsis = request.synopsis,
                    worldNotes = request.worldNotes,
                    paperSize = validatedPaperSize(request.paperSize),
                ),
            )
        documentRepository.save(Document(projectId = requireNotNull(project.id), sortOrder = 0))
        return projectMapper.toResponse(project)
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

        return PageResponse.from(projects.map(projectMapper::toResponse))
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
            val documentUpdatedAt =
                chapters.maxOfOrNull { requireNotNull(it.updatedAt) }
                    ?: requireNotNull(project.updatedAt) // 챕터 없는 경우 작품 수정 시각 fallback
            ProjectCardResponse.from(
                base = projectMapper.toResponse(project),
                wordCount = wordCount,
                documentUpdatedAt = documentUpdatedAt,
                totalDurationMs = durationByProjectId[projectId] ?: 0L,
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
            .map(projectMapper::toResponse)
            .orElseThrow { ResourceNotFoundException("Project not found") }

    @Transactional(rollbackFor = [Exception::class])
    fun updateProject(
        userId: Long,
        projectId: Long,
        request: UpdateProjectRequest,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)

        request.title?.let { project.title = it.trim() }
        request.genre?.let { project.genre = it }
        request.targetLength?.let { project.targetLength = it }
        request.toneNotes?.let { project.toneNotes = it }
        request.synopsis?.let { project.synopsis = it }
        request.worldNotes?.let { project.worldNotes = it }
        request.nextScene?.let { project.nextScene = it }
        request.paperSize?.let { project.paperSize = validatedPaperSize(it) }

        return projectMapper.toResponse(project)
    }

    /** 용지 크기 허용값 검증 — null 이면 기본 'A4', 비허용값이면 [ValidationException]. */
    private fun validatedPaperSize(value: String?): String {
        if (value == null) return "A4"
        if (value !in ALLOWED_PAPER_SIZES) {
            throw ValidationException("지원하지 않는 용지 크기입니다: $value")
        }
        return value
    }

    @Transactional(rollbackFor = [Exception::class])
    fun archiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.archive(Instant.now())
        return projectMapper.toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun unarchiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.unarchive()
        return projectMapper.toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteProject(
        userId: Long,
        projectId: Long,
    ) {
        val project = requireOwnedProject(userId, projectId)
        projectRepository.delete(project)
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
        private val ALLOWED_PAPER_SIZES = setOf("A4", "A3", "A2", "B4")
    }
}
