package com.writenote.model.response

import java.time.Instant

/**
 * 운영 툴 회원 조회 응답(030 US2) — 화이트리스트.
 * passwordHash·kakaoId 원문·failedLoginCount·lockoutUntil·토큰 등 비밀값은 절대 미포함(FR-010).
 */
data class AdminUserResponse(
    val id: Long,
    val email: String,
    val kakaoLinked: Boolean,
    val emailVerified: Boolean,
    val lastLoginAt: Instant?,
    val createdAt: Instant,
    val projectCount: Long,
)
