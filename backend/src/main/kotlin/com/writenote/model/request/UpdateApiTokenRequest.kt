package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class UpdateApiTokenRequest(
    @field:NotBlank(message = "label 은 비어있을 수 없습니다")
    @field:Size(max = 120, message = "label 은 120자 이하여야 합니다")
    val label: String,
)
