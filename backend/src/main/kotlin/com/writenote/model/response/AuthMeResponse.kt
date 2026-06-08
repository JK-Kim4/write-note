package com.writenote.model.response

import java.time.Instant

data class AuthMeResponse(
    val userId: Long,
    val email: String,
    val kakaoLinked: Boolean,
    val emailVerifiedAt: Instant?,
    val activeApiTokenCount: Int,
)
