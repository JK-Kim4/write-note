package com.writenote.model.request

import jakarta.validation.constraints.Size

/**
 * 모음 부분 수정 — null 필드는 미변경. [name] 이름 변경, [sortOrder] 표시 순서.
 */
data class UpdateCategoryRequest(
    @field:Size(min = 1, max = 60)
    val name: String? = null,
    val sortOrder: Int? = null,
)
