package com.writenote.service

import com.writenote.repository.WorkSessionRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

/**
 * dangling 작업 세션 정리 (FR-021, spec Q2 = 서버 스케줄러).
 *
 * 정상 종료 신호 없이 [maxOpenHours] 초과 열려 있는 세션은 의미 있는 종료 시각이 없으므로 폐기한다.
 * 재진입 시 정리(WorkSessionService.start)가 1차, 본 스케줄러가 다시 안 들어온 작품의 2차 안전망.
 * TokenCleanupService 와 동일한 @Scheduled 패턴.
 */
@Service
class WorkSessionCleanupService(
    private val workSessionRepository: WorkSessionRepository,
    @Value("\${app.work-session.max-open-hours:12}") private val maxOpenHours: Long,
) {
    private val log = LoggerFactory.getLogger(WorkSessionCleanupService::class.java)

    @Scheduled(cron = "\${app.work-session.cleanup-cron:0 0 * * * *}")
    @Transactional(rollbackFor = [Exception::class])
    fun cleanup() {
        val threshold = Instant.now().minus(Duration.ofHours(maxOpenHours))
        val deleted = workSessionRepository.deleteByEndedAtIsNullAndStartedAtBefore(threshold)
        if (deleted > 0) {
            log.info("Dangling work session cleanup: {} sessions discarded (started before {})", deleted, threshold)
        }
    }
}
