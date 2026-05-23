package com.writenote.model.response

data class SignupEmailResponse(
    val userId: Long,
    val email: String,
    val emailVerifySent: Boolean,
)
