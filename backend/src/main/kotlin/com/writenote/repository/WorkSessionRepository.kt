package com.writenote.repository

import com.writenote.entity.WorkSession
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

interface WorkSessionRepository : JpaRepository<WorkSession, Long> {
    /** 작품의 열린 세션(ended_at IS NULL) — 작품당 1개 불변식. */
    fun findFirstByProjectIdAndEndedAtIsNull(projectId: Long): WorkSession?

    /** 작품의 종료된 세션 — 총 작업시간 합산용(진행 중 제외). */
    fun findByProjectIdAndEndedAtIsNotNull(projectId: Long): List<WorkSession>

    /** dangling 정리 — 임계 시각 이전 시작된 열린 세션 폐기(FR-021). 삭제 행 수 반환. */
    fun deleteByEndedAtIsNullAndStartedAtBefore(threshold: Instant): Long

    /** 카드 집계용 일괄 조회(018) — 여러 작품의 종료된 세션을 IN 으로 한 번에. */
    fun findByProjectIdInAndEndedAtIsNotNull(projectIds: Collection<Long>): List<WorkSession>
}
