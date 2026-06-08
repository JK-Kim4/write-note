package com.writenote.service

import com.writenote.repository.AuthTokenRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant

/**
 * [TokenCleanupService] 단위 테스트 — Repository 호출 시점 / 인자 / 횟수 검증.
 *
 * 출처: tasks.md T072. Repository mock 으로 외부 의존 격리.
 */
class TokenCleanupServiceTest {
    private val authTokenRepository = mockk<AuthTokenRepository>()
    private val service = TokenCleanupService(authTokenRepository)

    @Test
    @DisplayName("cleanup 호출 시 AuthTokenRepository.cleanupExpiredAndUsed 가 현재 시각 인자로 1회 호출된다")
    fun `cleanup invokes repository cleanupExpiredAndUsed with current Instant`() {
        every {
            authTokenRepository.cleanupExpiredAndUsed(match { it.isAfter(Instant.now().minusSeconds(5)) })
        } returns 7

        service.cleanup()

        verify(exactly = 1) {
            authTokenRepository.cleanupExpiredAndUsed(match { it.isAfter(Instant.now().minusSeconds(5)) })
        }
    }
}
