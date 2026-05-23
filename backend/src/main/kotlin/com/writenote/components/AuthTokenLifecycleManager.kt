package com.writenote.components

import com.writenote.entity.AuthToken
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * 보조 토큰의 사용 가능 여부 검증 및 사용 처리 컴포넌트.
 *
 * - 만료 검증: [expiresAt] < [now] → [AuthErrorCode.AUTH_TOKEN_EXPIRED]
 * - 일회용 재사용 거부: [AuthTokenType.EMAIL_VERIFY] / [AuthTokenType.PASSWORD_RESET] 의 [usedAt] != null
 *   → [AuthErrorCode.AUTH_TOKEN_ALREADY_USED]
 *
 * 출처: research.md R-6, contracts/token-formats.md §3 §4.
 */
@Component
class AuthTokenLifecycleManager {
    /**
     * 토큰 사용 가능 여부 검증. 위반 시 [AuthException] throw.
     *
     * @param token 검증할 토큰 엔티티
     * @param now 현재 시각 (기본값 현재 시각 — 테스트에서 고정 시각 주입 가능)
     */
    fun assertUsable(
        token: AuthToken,
        now: Instant = Instant.now(),
    ) {
        if (token.expiresAt < now) {
            throw AuthException(AuthErrorCode.AUTH_TOKEN_EXPIRED)
        }
        if (token.type in ONE_TIME_TYPES && token.usedAt != null) {
            throw AuthException(AuthErrorCode.AUTH_TOKEN_ALREADY_USED)
        }
    }

    /**
     * 일회용 토큰 사용 처리 — [AuthToken.usedAt] 갱신.
     *
     * 호출자가 트랜잭션 안에서 saveAndFlush 의무.
     *
     * @param token 사용 처리할 토큰 엔티티
     * @param now 사용 시각 (기본값 현재 시각 — 테스트에서 고정 시각 주입 가능)
     * @return 갱신된 토큰 엔티티 (동일 인스턴스)
     */
    fun markUsed(
        token: AuthToken,
        now: Instant = Instant.now(),
    ): AuthToken {
        token.usedAt = now
        return token
    }

    companion object {
        private val ONE_TIME_TYPES =
            setOf(AuthTokenType.EMAIL_VERIFY, AuthTokenType.PASSWORD_RESET)
    }
}
