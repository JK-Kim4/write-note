package com.writenote.auth

data class EmailVerificationRequestedEvent(
    val userId: Long,
    val email: String,
    val plaintextToken: String,
)
