package com.writenote.model.response

import java.time.Instant

/**
 * 토큰 발급 직후 1회만 반환하는 응답.
 *
 * [token] 은 평문 원본 — 이 응답 이후 원본은 서버에서 조회 불가 (DB 에는 hash 만 저장).
 */
data class ApiTokenCreatedResponse(
    val id: Long,
    /** 평문 원본 토큰 (`wnt_` + base62 32자) — 발급 응답에서만 1회 노출 */
    val token: String,
    /** UI 식별용 앞 8자 (`wnt_XXXX`) */
    val tokenPrefix: String,
    val label: String,
    val createdAt: Instant,
)
