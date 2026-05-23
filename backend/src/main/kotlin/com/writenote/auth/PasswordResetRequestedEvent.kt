package com.writenote.auth

data class PasswordResetRequestedEvent(
    val userId: Long,
    val email: String,
    val plaintextToken: String,
)
