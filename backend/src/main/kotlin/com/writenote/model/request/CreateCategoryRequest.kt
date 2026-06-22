package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * 모음 생성 요청. [parentId] 는 N뎁스 설계용이나 v1 은 서비스가 비-null 을 거부(1뎁스 강제, FR-010).
 */
data class CreateCategoryRequest(
    @field:NotBlank
    @field:Size(max = 60)
    val name: String,
    val parentId: Long? = null,
)
