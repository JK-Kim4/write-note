package com.writenote.service

import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.entity.WorkSession
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.Instant
import java.util.UUID

/**
 * FR-020 / SC-004 — endWithLog 원자성의 실제 DB 트랜잭션 롤백 검증.
 *
 * 단위 테스트(WorkSessionServiceTest)는 예외 전파만 검증하므로, 여기서 ProjectLogService 를
 * 실패하도록 override 하여 세션 종료(ended_at)가 커밋되지 않고 롤백됨을 실제 DB 로 확인한다.
 */
@SpringBootTest
@ActiveProfiles("test")
class WorkSessionEndWithLogRollbackIT {
    @MockitoBean private lateinit var projectLogService: ProjectLogService

    @Autowired private lateinit var workSessionService: WorkSessionService

    @Autowired private lateinit var workSessionRepository: WorkSessionRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var userRepository: UserRepository

    @Test
    fun `endWithLog rolls back session end when log creation fails`() {
        val userId =
            userRepository.saveAndFlush(User(email = "rb-${UUID.randomUUID()}@example.com", passwordHash = "h")).id!!
        val projectId = projectRepository.saveAndFlush(Project(userId = userId, title = "롤백 작품")).id!!
        val sessionId =
            workSessionRepository
                .saveAndFlush(WorkSession(userId = userId, projectId = projectId, startedAt = Instant.now().minusSeconds(120)))
                .id!!

        whenever(projectLogService.create(any(), any(), any())).thenThrow(IllegalStateException("log insert failed"))

        assertThrows<IllegalStateException> {
            workSessionService.endWithLog(userId = userId, projectId = projectId, body = "마무리")
        }

        // AS6 — 로그 생성 실패 시 세션 종료도 롤백(부분 적용 없음): 세션은 여전히 열린 상태여야 한다.
        val reloaded = workSessionRepository.findById(sessionId).orElseThrow()
        assertThat(reloaded.endedAt).isNull()
    }
}
