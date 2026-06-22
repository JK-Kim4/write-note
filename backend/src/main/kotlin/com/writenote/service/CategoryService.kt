package com.writenote.service

import com.writenote.entity.Category
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.CategoryMapper
import com.writenote.model.request.CreateCategoryRequest
import com.writenote.model.request.UpdateCategoryRequest
import com.writenote.model.response.CategoryResponse
import com.writenote.repository.CategoryRepository
import com.writenote.repository.ProjectRepository
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
                ),
            )
        return categoryMapper.toResponse(category, projectCount = 0)
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
        return categories.map { category ->
            categoryMapper.toResponse(category, projectCount = countByCategoryId[category.id] ?: 0)
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
        val count =
            projectRepository
                .countActiveByCategory(userId)
                .firstOrNull { it.categoryId == categoryId }
                ?.cnt
                ?.toInt() ?: 0
        return categoryMapper.toResponse(category, projectCount = count)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun delete(
        userId: Long,
        categoryId: Long,
    ) {
        val category = requireOwnedCategory(userId, categoryId)
        // 소속 작품은 DB FK ON DELETE SET NULL 로 미분류 전환(작품 무손실, FR-007)
        categoryRepository.delete(category)
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
}
