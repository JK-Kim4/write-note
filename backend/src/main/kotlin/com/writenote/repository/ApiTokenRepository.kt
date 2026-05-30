package com.writenote.repository

import com.writenote.entity.ApiToken
import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface ApiTokenRepository : JpaRepository<ApiToken, Long> {
    /** SHA-256 hex 로 토큰 조회 — ApiTokenAuthenticationFilter 검증용 */
    fun findByTokenHash(tokenHash: String): ApiToken?

    /** 소유자 격리 단건 조회 — 타인 토큰은 empty (FR-024) */
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Optional<ApiToken>

    /** 본인 전체 토큰 목록 (활성+해지) — 발급 최신 순 */
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<ApiToken>

    /** 활성 토큰 수 (/api/auth/me activeApiTokenCount 결선용) */
    fun countByUserIdAndRevokedAtIsNull(userId: Long): Long
}
