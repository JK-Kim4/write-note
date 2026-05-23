package com.writenote.service

import com.writenote.repository.AuthTokenRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 만료된 / 사용 완료된 AuthToken 일일 청소 (FR-046).
 *
 * 매일 자정 (서버 로컬 타임존) 에 [AuthTokenRepository.cleanupExpiredAndUsed] 호출.
 * `usedTypes = EMAIL_VERIFY + PASSWORD_RESET` 만 `used_at IS NOT NULL` 매치 영역 — REFRESH 는
 * 명시 logout/password-reset 시 삭제되므로 cleanup 대상이 아님 (Repository 내부 패턴).
 *
 * 출처: data-model.md §5, tasks.md T072.
 */
@Service
class TokenCleanupService(
    private val authTokenRepository: AuthTokenRepository,
) {
    private val log = LoggerFactory.getLogger(TokenCleanupService::class.java)

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional(rollbackFor = [Exception::class])
    fun cleanup() {
        val now = Instant.now()
        val deleted = authTokenRepository.cleanupExpiredAndUsed(now)
        log.info("AuthToken cleanup completed: {} tokens deleted at {}", deleted, now)
    }
}
