package com.writenote.repository

import com.writenote.entity.ApiToken
import org.springframework.data.jpa.repository.JpaRepository

interface ApiTokenRepository : JpaRepository<ApiToken, Long> {
    /** SHA-256 hex 로 토큰 조회 — ApiTokenAuthenticationFilter 검증용 */
    fun findByTokenHash(tokenHash: String): ApiToken?
}
