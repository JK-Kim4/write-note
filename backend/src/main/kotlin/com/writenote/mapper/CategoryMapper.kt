package com.writenote.mapper

import com.writenote.entity.Category
import com.writenote.model.response.CategoryResponse
import org.springframework.stereotype.Component

@Component
class CategoryMapper {
    fun toResponse(
        category: Category,
        projectCount: Int,
        totalWordCount: Int = 0,
        totalDurationMs: Long = 0L,
    ): CategoryResponse =
        CategoryResponse(
            id = requireNotNull(category.id),
            name = category.name,
            parentId = category.parentId,
            sortOrder = category.sortOrder,
            projectCount = projectCount,
            paperSize = category.paperSize,
            layoutMode = category.layoutMode,
            genre = category.genre,
            synopsis = category.synopsis,
            targetLength = category.targetLength,
            totalWordCount = totalWordCount,
            totalDurationMs = totalDurationMs,
            createdAt = requireNotNull(category.createdAt),
            updatedAt = requireNotNull(category.updatedAt),
        )
}
