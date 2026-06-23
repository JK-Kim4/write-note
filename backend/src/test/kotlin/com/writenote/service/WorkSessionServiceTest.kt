package com.writenote.service

import com.writenote.entity.Project
import com.writenote.entity.WorkSession
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.response.ProjectLogResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.WorkSessionRepository
import io.mockk.every
import io.mockk.justRun
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Instant
import java.util.Optional

class WorkSessionServiceTest {
    private val workSessionRepository = mockk<WorkSessionRepository>()
    private val projectRepository = mockk<ProjectRepository>()
    private val projectLogService = mockk<ProjectLogService>()
    private val service = WorkSessionService(workSessionRepository, projectRepository, projectLogService, minSessionSeconds = 30L)

    @BeforeEach
    fun stubCommon() {
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(Project(id = 100L, userId = 1L))
        every { workSessionRepository.save(any<WorkSession>()) } answers {
            firstArg<WorkSession>().apply { if (id == null) id = 99L }
        }
        justRun { workSessionRepository.flush() }
        justRun { workSessionRepository.delete(any<WorkSession>()) }
    }

    @Test
    @DisplayName("start — 기존 열린 세션(≥30s)을 종료 보존하고 새 세션을 연다")
    fun `start closes existing open session then opens new`() {
        val existing = WorkSession(id = 5L, projectId = 100L, startedAt = Instant.now().minusSeconds(120))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns existing

        val result = service.start(userId = 1L, projectId = 100L)

        assertThat(existing.endedAt).isNotNull() // 120s ≥ 30s → 보존(종료)
        assertThat(result.endedAt).isNull() // 새 세션은 열림
        assertThat(result.projectId).isEqualTo(100L)
    }

    @Test
    @DisplayName("totalDurationMs — 종료된 세션 지속의 합(ms)")
    fun `total sums ended session durations`() {
        val base = Instant.parse("2026-06-08T00:00:00Z")
        every { workSessionRepository.findByProjectIdAndEndedAtIsNotNull(100L) } returns
            listOf(
                WorkSession(id = 1L, projectId = 100L, startedAt = base, endedAt = base.plusMillis(1_000)),
                WorkSession(id = 2L, projectId = 100L, startedAt = base, endedAt = base.plusMillis(2_000)),
            )

        assertThat(service.totalDurationMs(userId = 1L, projectId = 100L)).isEqualTo(3_000L)
    }

    @Test
    @DisplayName("end — 열린 세션이 없으면 null")
    fun `end returns null when no open session`() {
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns null

        assertThat(service.end(userId = 1L, projectId = 100L)).isNull()
    }

    @Test
    @DisplayName("end — 30초 미만 세션도 폐기하지 않고 보존한다(타임워치)")
    fun `end preserves session shorter than threshold`() {
        val open = WorkSession(id = 7L, userId = 1L, projectId = 100L, startedAt = Instant.now().minusSeconds(5))
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(Project(id = 100L, userId = 1L))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns open
        every { workSessionRepository.save(any<WorkSession>()) } answers { firstArg() }

        val result = service.end(userId = 1L, projectId = 100L)

        assertThat(result).isNotNull()
        assertThat(open.endedAt).isNotNull() // 5s < 30s 이지만 보존
        verify(exactly = 0) { workSessionRepository.delete(any<WorkSession>()) }
    }

    @Test
    @DisplayName("endWithLog — 기록 생성 실패 시 예외 전파(트랜잭션 롤백 신호)")
    fun `endWithLog propagates failure from log creation`() {
        val open = WorkSession(id = 7L, projectId = 100L, startedAt = Instant.now().minusSeconds(5))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns open
        every { projectLogService.create(1L, 100L, "기록") } throws IllegalStateException("log insert failed")

        assertThrows<IllegalStateException> { service.endWithLog(userId = 1L, projectId = 100L, body = "기록") }
    }

    @Test
    @DisplayName("endWithLog — 짧은 세션도 종료 보존 + 기록 생성")
    fun `endWithLog preserves short session and creates log`() {
        val open = WorkSession(id = 7L, projectId = 100L, startedAt = Instant.now().minusSeconds(5))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns open
        every { projectLogService.create(1L, 100L, "기록") } returns
            ProjectLogResponse(id = 50L, projectId = 100L, body = "기록", createdAt = Instant.now())

        val result = service.endWithLog(userId = 1L, projectId = 100L, body = "기록")

        assertThat(open.endedAt).isNotNull() // 5s < 30s 이지만 endWithLog 는 보존
        assertThat(result.session?.endedAt).isNotNull()
        assertThat(result.log.id).isEqualTo(50L)
    }

    // ── 018 기간 합계 rangeTotalDurationMs ──────────────────────────────────

    @Test
    @DisplayName("rangeTotal — 범위 내(from 포함·to 제외) 시작된 종료 세션만 합산한다")
    fun `rangeTotal sums ended sessions started within range`() {
        val from = Instant.parse("2026-06-08T00:00:00Z")
        val to = Instant.parse("2026-06-15T00:00:00Z")
        every { workSessionRepository.findEndedByUserIdAndStartedAtRange(1L, from, to) } returns
            listOf(
                WorkSession(id = 1L, projectId = 100L, startedAt = from, endedAt = from.plusMillis(1_200_000)),
                WorkSession(
                    id = 2L,
                    projectId = 200L,
                    startedAt = from.plusSeconds(3600),
                    endedAt = from.plusSeconds(3600).plusMillis(600_000),
                ),
            )

        val total = service.rangeTotalDurationMs(userId = 1L, from = from, to = to)

        assertThat(total).isEqualTo(1_800_000L)
    }

    @Test
    @DisplayName("rangeTotal — 범위 내 세션이 없으면 0")
    fun `rangeTotal returns zero when no session in range`() {
        val from = Instant.parse("2026-06-08T00:00:00Z")
        val to = Instant.parse("2026-06-15T00:00:00Z")
        every { workSessionRepository.findEndedByUserIdAndStartedAtRange(1L, from, to) } returns emptyList()

        assertThat(service.rangeTotalDurationMs(userId = 1L, from = from, to = to)).isEqualTo(0L)
    }

    @Test
    @DisplayName("rangeTotal — from >= to 는 ValidationException(→ 400 VALIDATION_FAILED)")
    fun `rangeTotal rejects inverted range`() {
        val from = Instant.parse("2026-06-15T00:00:00Z")
        val to = Instant.parse("2026-06-08T00:00:00Z")

        assertThrows<ValidationException> { service.rangeTotalDurationMs(userId = 1L, from = from, to = to) }
        assertThrows<ValidationException> { service.rangeTotalDurationMs(userId = 1L, from = to, to = to) }
    }

    @Test
    @DisplayName("currentOpenSession — 작품의 열린 세션을 반환(동시 start 경합 흡수용)")
    fun `currentOpenSession returns the open session`() {
        val open = WorkSession(id = 7L, projectId = 100L, startedAt = Instant.parse("2026-06-10T00:00:00Z"))
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns open

        val result = service.currentOpenSession(userId = 1L, projectId = 100L)

        assertThat(result?.id).isEqualTo(7L)
        assertThat(result?.endedAt).isNull()
    }

    @Test
    @DisplayName("currentOpenSession — 열린 세션이 없으면 null")
    fun `currentOpenSession returns null when none open`() {
        every { workSessionRepository.findFirstByProjectIdAndEndedAtIsNull(100L) } returns null

        assertThat(service.currentOpenSession(userId = 1L, projectId = 100L)).isNull()
    }

    @Test
    @DisplayName("currentOpenSession — 타 사용자 작품이면 ResourceNotFoundException")
    fun `currentOpenSession rejects non-owner`() {
        every { projectRepository.findByIdAndUserId(100L, 9L) } returns Optional.empty()

        assertThrows<ResourceNotFoundException> { service.currentOpenSession(userId = 9L, projectId = 100L) }
    }
}
