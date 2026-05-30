package com.writenote.model.request

import jakarta.validation.constraints.Size

data class CreateApiTokenRequest(
    @field:Size(max = 120, message = "label 은 120자 이하여야 합니다")
    val label: String = "새 토큰",
)
