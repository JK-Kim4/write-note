package com.writenote.mapper

import com.writenote.entity.Category
import com.writenote.model.response.CategoryResponse
import org.springframework.stereotype.Component

@Component
class CategoryMapper {
    fun toResponse(
        category: Category,
        projectCount: Int,
    ): CategoryResponse =
        CategoryResponse(
            id = requireNotNull(category.id),
            name = category.name,
            parentId = category.parentId,
            sortOrder = category.sortOrder,
            projectCount = projectCount,
            createdAt = requireNotNull(category.createdAt),
            updatedAt = requireNotNull(category.updatedAt),
        )
}
