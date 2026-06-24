package com.writenote.model.response

import java.time.Instant

data class AuthMeResponse(
    val userId: Long,
    val email: String,
    val nickname: String,
    val kakaoLinked: Boolean,
    val emailVerifiedAt: Instant?,
    val activeApiTokenCount: Int,
    val createdAt: Instant?,
    val passwordSet: Boolean,
)
