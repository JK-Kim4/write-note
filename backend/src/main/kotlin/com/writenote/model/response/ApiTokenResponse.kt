package com.writenote.model.response

import java.time.Instant

/**
 * 토큰 목록·수정·조회 응답 — 평문 원본 [token] 미포함.
 */
data class ApiTokenResponse(
    val id: Long,
    /** UI 식별용 앞 8자 (`wnt_XXXX`) */
    val tokenPrefix: String,
    val label: String,
    val lastUsedAt: Instant?,
    val createdAt: Instant,
    /** 해지 시각 — null 이면 활성 */
    val revokedAt: Instant?,
)
