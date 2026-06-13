package com.writenote.repository

import com.writenote.entity.WorkSession
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
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

    /**
     * 기간 합계용(018) — 사용자 전체 작품 횡단(아카이브·삭제 작품 포함), [from, to) 에 시작된 종료 세션.
     * 트랙2: WorkSession.userId 직접 스코프 → 작품 삭제(project_id=NULL)된 세션도 전체 합계에 보존.
     */
    @Query(
        "SELECT w FROM WorkSession w WHERE w.userId = :userId " +
            "AND w.endedAt IS NOT NULL AND w.startedAt >= :from AND w.startedAt < :to",
    )
    fun findEndedByUserIdAndStartedAtRange(
        @Param("userId") userId: Long,
        @Param("from") from: Instant,
        @Param("to") to: Instant,
    ): List<WorkSession>
}
