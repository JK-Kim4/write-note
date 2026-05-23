package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

data class PasswordResetConfirmRequest(
    @field:NotBlank
    val token: String,
    @field:NotBlank
    val newPassword: String,
)
