package com.writenote.components

import com.writenote.entity.AuthToken
import com.writenote.enums.AuthErrorCode
import com.writenote.enums.AuthTokenType
import com.writenote.error.AuthException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant

class AuthTokenLifecycleManagerTest {
    private val manager = AuthTokenLifecycleManager()

    private fun emailVerifyToken(
        expiresAt: Instant = Instant.now().plus(Duration.ofMinutes(30)),
        usedAt: Instant? = null,
    ) = AuthToken(
        userId = 1L,
        type = AuthTokenType.EMAIL_VERIFY,
        tokenHash = "hash",
        expiresAt = expiresAt,
        usedAt = usedAt,
    )

    @Test
    fun `유효 토큰 assertUsable 통과`() {
        val token =
            emailVerifyToken(
                expiresAt = Instant.now().plus(Duration.ofMinutes(30)),
                usedAt = null,
            )
        assertThatCode { manager.assertUsable(token) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `만료된 토큰 assertUsable AUTH_TOKEN_EXPIRED`() {
        val token =
            emailVerifyToken(
                expiresAt = Instant.now().minus(Duration.ofSeconds(1)),
            )
        assertThatThrownBy { manager.assertUsable(token) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_EXPIRED)
    }

    @Test
    fun `EMAIL_VERIFY usedAt 있으면 AUTH_TOKEN_ALREADY_USED`() {
        val token = emailVerifyToken(usedAt = Instant.now().minus(Duration.ofMinutes(5)))
        assertThatThrownBy { manager.assertUsable(token) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_ALREADY_USED)
    }

    @Test
    fun `PASSWORD_RESET usedAt 있으면 AUTH_TOKEN_ALREADY_USED`() {
        val token =
            AuthToken(
                userId = 1L,
                type = AuthTokenType.PASSWORD_RESET,
                tokenHash = "hash",
                expiresAt = Instant.now().plus(Duration.ofMinutes(30)),
                usedAt = Instant.now().minus(Duration.ofMinutes(1)),
            )
        assertThatThrownBy { manager.assertUsable(token) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_ALREADY_USED)
    }

    @Test
    fun `REFRESH usedAt 있어도 assertUsable 통과 (ONE_TIME_TYPES 외)`() {
        val token =
            AuthToken(
                userId = 1L,
                type = AuthTokenType.REFRESH,
                tokenHash = "hash",
                expiresAt = Instant.now().plus(Duration.ofDays(30)),
                usedAt = Instant.now().minus(Duration.ofMinutes(1)),
            )
        // REFRESH 는 ONE_TIME_TYPES 에 속하지 않으므로 usedAt 이 있어도 통과
        assertThatCode { manager.assertUsable(token) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `markUsed 호출 후 usedAt 갱신`() {
        val token = emailVerifyToken(usedAt = null)
        val now = Instant.now()
        val result = manager.markUsed(token, now)
        assertThat(result.usedAt).isEqualTo(now)
    }
}
