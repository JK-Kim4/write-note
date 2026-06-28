package com.writenote.service

import com.writenote.entity.Category
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.CategoryMapper
import com.writenote.model.request.CreateCategoryRequest
import com.writenote.model.request.UpdateCategoryRequest
import com.writenote.model.response.CategoryResponse
import com.writenote.repository.BoardRepository
import com.writenote.repository.CategoryRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.ShareLinkRepository
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 모음(카테고리, 032) 유스케이스 — 작가별 격리(모든 조회·수정·삭제는 본인 것만, 아니면 404).
 *
 * [projectCount] 는 활성 작품(보관 제외) 집계로 동봉한다(빈 모음=0 도 목록 포함). v1 은
 * 1뎁스 강제 — [CreateCategoryRequest.parentId] 비-null 은 [ValidationException].
 */
@Service
class CategoryService(
    private val categoryRepository: CategoryRepository,
    private val projectRepository: ProjectRepository,
    private val userRepository: UserRepository,
    private val categoryMapper: CategoryMapper,
    private val boardRepository: BoardRepository,
    private val shareLinkRepository: ShareLinkRepository,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun create(
        userId: Long,
        request: CreateCategoryRequest,
    ): CategoryResponse {
        requireExistingUser(userId)
        if (request.parentId != null) {
            throw ValidationException("현재는 1단계 모음만 지원합니다(하위 모음 불가)")
        }
        val name = request.name.trim()
        if (name.isEmpty()) {
            throw ValidationException("모음 이름은 비어 있을 수 없습니다")
        }
        val category =
            categoryRepository.save(
                Category(
                    userId = userId,
                    name = name,
                    parentId = null,
                    sortOrder = categoryRepository.maxSortOrder(userId) + 1,
                    paperSize = validatedPaperSize(request.paperSize),
                    layoutMode = validatedLayoutMode(request.layoutMode),
                    genre = request.genre,
                    synopsis = request.synopsis,
                    targetLength = request.targetLength,
                ),
            )
        // 신규 시리즈는 소속 작품 0 → totalWordCount·totalDurationMs 0(집계 쿼리 불필요)
        return categoryMapper.toResponse(category, projectCount = 0, totalWordCount = 0, totalDurationMs = 0L)
    }

    @Transactional(readOnly = true)
    fun list(userId: Long): List<CategoryResponse> {
        requireExistingUser(userId)
        val categories = categoryRepository.findByUserIdOrderBySortOrderAscIdAsc(userId)
        if (categories.isEmpty()) {
            return emptyList()
        }
        val countByCategoryId =
            projectRepository
                .countActiveByCategory(userId)
                .associate { it.categoryId to it.cnt.toInt() }
        val wordCountByCategoryId =
            projectRepository
                .sumWordCountByCategory(userId)
                .associate { it.categoryId to it.totalWordCount.toInt() }
        val durationByCategoryId =
            projectRepository
                .sumDurationByCategory(userId)
                .associate { it.categoryId to it.totalDurationMs }
        return categories.map { category ->
            categoryMapper.toResponse(
                category,
                projectCount = countByCategoryId[category.id] ?: 0,
                totalWordCount = wordCountByCategoryId[category.id] ?: 0,
                totalDurationMs = durationByCategoryId[category.id] ?: 0L,
            )
        }
    }

    @Transactional(rollbackFor = [Exception::class])
    fun rename(
        userId: Long,
        categoryId: Long,
        request: UpdateCategoryRequest,
    ): CategoryResponse {
        val category = requireOwnedCategory(userId, categoryId)
        request.name?.let {
            val name = it.trim()
            if (name.isEmpty()) {
                throw ValidationException("모음 이름은 비어 있을 수 없습니다")
            }
            category.name = name
        }
        request.sortOrder?.let { category.sortOrder = it }
        request.paperSize?.let { category.paperSize = validatedPaperSize(it) }
        request.layoutMode?.let { category.layoutMode = validatedLayoutMode(it) }
        request.genre?.let { category.genre = it }
        request.synopsis?.let { category.synopsis = it }
        request.targetLength?.let { category.targetLength = it }
        val count =
            projectRepository
                .countActiveByCategory(userId)
                .firstOrNull { it.categoryId == categoryId }
                ?.cnt
                ?.toInt() ?: 0
        val totalWordCount =
            projectRepository
                .sumWordCountByCategory(userId)
                .firstOrNull { it.categoryId == categoryId }
                ?.totalWordCount
                ?.toInt() ?: 0
        val totalDurationMs =
            projectRepository
                .sumDurationByCategory(userId)
                .firstOrNull { it.categoryId == categoryId }
                ?.totalDurationMs ?: 0L
        return categoryMapper.toResponse(
            category,
            projectCount = count,
            totalWordCount = totalWordCount,
            totalDurationMs = totalDurationMs,
        )
    }

    @Transactional(rollbackFor = [Exception::class])
    fun delete(
        userId: Long,
        categoryId: Long,
    ) {
        val category = requireOwnedCategory(userId, categoryId)
        // 소속 작품은 DB FK ON DELETE SET NULL 로 미분류 전환(작품 무손실, FR-007)
        // 이 시리즈에 소속된 플롯 보드(041)는 아이디어 보드로 강등(보드 보존). 다형이라 DB FK 불가 → 앱 처리.
        boardRepository.clearOwner("category", categoryId)
        // 이 시리즈의 공유 링크(046)는 비활성(스냅샷·댓글은 보존 — 피드백 이력 유지, R-5/FR-025).
        shareLinkRepository.deactivateByTarget("series", categoryId)
        categoryRepository.delete(category)
    }

    /** 시리즈 판형 검증(033 R2) — null=미설정(허용), 비허용 식별자면 [ValidationException]. */
    private fun validatedPaperSize(value: String?): String? {
        if (value == null) return null
        if (value !in ALLOWED_PAPER_SIZES) {
            throw ValidationException("지원하지 않는 용지 크기입니다: $value")
        }
        return value
    }

    /** 시리즈 출판방식 검증(033 R2) — null=미설정(허용), paper/web 외 값이면 [ValidationException]. */
    private fun validatedLayoutMode(value: String?): String? {
        if (value == null) return null
        if (value !in ALLOWED_LAYOUT_MODES) {
            throw ValidationException("지원하지 않는 출판 방식입니다: $value")
        }
        return value
    }

    private fun requireOwnedCategory(
        userId: Long,
        categoryId: Long,
    ): Category =
        categoryRepository
            .findByIdAndUserId(categoryId, userId)
            .orElseThrow { ResourceNotFoundException("Category not found") }

    private fun requireExistingUser(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw ResourceNotFoundException("User not found")
        }
    }

    companion object {
        private val ALLOWED_PAPER_SIZES = setOf("A4", "A3", "A2", "B4", "sinkukpan", "kukpan", "pan46", "mungopan")
        private val ALLOWED_LAYOUT_MODES = setOf("paper", "web")
    }
}
