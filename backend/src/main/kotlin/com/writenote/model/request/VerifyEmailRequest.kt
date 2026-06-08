package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

data class VerifyEmailRequest(
    @field:NotBlank
    val token: String,
)
