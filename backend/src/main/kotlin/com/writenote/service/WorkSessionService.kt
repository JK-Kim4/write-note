package com.writenote.service

import com.writenote.entity.WorkSession
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.response.EndWithLogResponse
import com.writenote.model.response.WorkSessionResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.WorkSessionRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 작업 세션 — 시작/자동종료/종료+기록/총합. 작품 소유권 경유 격리.
 *
 * - start: 작품의 기존 열린 세션을 먼저 정리(30s 규칙)한 뒤 새 세션 시작(작품당 1개, FR-016).
 * - end: 자동 종료. 지속 [minSessionSeconds] 미만이면 폐기(삭제), 이상이면 ended_at 기록(FR-017/018).
 * - endWithLog: 세션 종료(30s 우회 — 짧아도 보존) + 집필 기록 생성을 단일 트랜잭션(FR-019/020).
 */
@Service
class WorkSessionService(
    private val workSessionRepository: WorkSessionRepository,
    private val projectRepository: ProjectRepository,
    private val projectLogService: ProjectLogService,
    @Value("\${app.work-session.min-session-seconds:30}") private val minSessionSeconds: Long,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun start(
        userId: Long,
        projectId: Long,
    ): WorkSessionResponse {
        requireOwnedProject(userId, projectId)
        val now = Instant.now()
        workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId)?.let { closeOpen(it, now) }
        // 기존 열린 세션 정리를 먼저 반영해야 partial unique(uq_work_session_open) 충돌이 없다.
        workSessionRepository.flush()
        val saved = workSessionRepository.save(WorkSession(projectId = projectId, startedAt = now))
        return saved.toResponse()
    }

    @Transactional(rollbackFor = [Exception::class])
    fun end(
        userId: Long,
        projectId: Long,
    ): WorkSessionResponse? {
        requireOwnedProject(userId, projectId)
        val open = workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId) ?: return null
        return closeOpen(open, Instant.now())?.toResponse()
    }

    @Transactional(rollbackFor = [Exception::class])
    fun endWithLog(
        userId: Long,
        projectId: Long,
        body: String,
    ): EndWithLogResponse {
        requireOwnedProject(userId, projectId)
        val now = Instant.now()
        val open = workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId)
        val sessionResponse =
            open?.let {
                it.endedAt = now
                workSessionRepository.save(it).toResponse()
            }
        val log = projectLogService.create(userId, projectId, body)
        return EndWithLogResponse(session = sessionResponse, log = log)
    }

    /**
     * 기간 작업시간 합계(018) — 사용자 전체 작품 횡단, [from] 포함·[to] 제외 범위에 시작된 종료 세션 합(ms).
     * 기간 경계에 걸친 세션은 시작 시각 기준 귀속(이중 계산 없음). 시간대 환산은 클라이언트 책임.
     */
    @Transactional(readOnly = true)
    fun rangeTotalDurationMs(
        userId: Long,
        from: Instant,
        to: Instant,
    ): Long {
        if (from >= to) {
            throw ValidationException("from must be before to")
        }
        return workSessionRepository.findEndedByUserIdAndStartedAtRange(userId, from, to).sumOf {
            requireNotNull(it.endedAt).toEpochMilli() - requireNotNull(it.startedAt).toEpochMilli()
        }
    }

    /** 동시 start 경합 흡수용(018) — 작품의 열린 세션을 반환. start 의 unique 위반 catch 후 재사용. */
    @Transactional(readOnly = true)
    fun currentOpenSession(
        userId: Long,
        projectId: Long,
    ): WorkSessionResponse? {
        requireOwnedProject(userId, projectId)
        return workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(projectId)?.toResponse()
    }

    @Transactional(readOnly = true)
    fun totalDurationMs(
        userId: Long,
        projectId: Long,
    ): Long {
        requireOwnedProject(userId, projectId)
        return workSessionRepository.findByProjectIdAndEndedAtIsNotNull(projectId).sumOf {
            requireNotNull(it.endedAt).toEpochMilli() - requireNotNull(it.startedAt).toEpochMilli()
        }
    }

    /** 자동 종료 규칙: 임계 미만 폐기(삭제 → null), 이상 ended_at 기록(보존 → 세션). */
    private fun closeOpen(
        open: WorkSession,
        now: Instant,
    ): WorkSession? {
        val durationMs = now.toEpochMilli() - requireNotNull(open.startedAt).toEpochMilli()
        return if (durationMs < minSessionSeconds * 1000) {
            workSessionRepository.delete(open)
            null
        } else {
            open.endedAt = now
            workSessionRepository.save(open)
        }
    }

    private fun requireOwnedProject(
        userId: Long,
        projectId: Long,
    ) {
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ResourceNotFoundException("Project not found") }
    }

    private fun WorkSession.toResponse(): WorkSessionResponse =
        WorkSessionResponse(
            id = requireNotNull(id),
            projectId = projectId,
            startedAt = requireNotNull(startedAt),
            endedAt = endedAt,
        )
}
