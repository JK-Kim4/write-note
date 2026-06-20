package com.writenote.service

import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.entity.WorkSession
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
class WorkSessionCleanupServiceTest {
    @Autowired private lateinit var cleanupService: WorkSessionCleanupService

    @Autowired private lateinit var workSessionRepository: WorkSessionRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var userRepository: UserRepository

    @Test
    fun `cleanup discards dangling open sessions older than maxOpenHours, keeps recent and ended`() {
        val userId =
            userRepository
                .saveAndFlush(User(email = "cleanup-${UUID.randomUUID()}@example.com", passwordHash = "h"))
                .id!!
        val project = projectRepository.saveAndFlush(Project(userId = userId, title = "정리 작품"))
        val pid = project.id!!

        // 13시간 전 시작된 dangling 열린 세션 (기본 max-open-hours=12 초과 → 폐기 대상)
        val stale =
            workSessionRepository
                .saveAndFlush(WorkSession(userId = userId, projectId = pid, startedAt = Instant.now().minusSeconds(13 * 3600)))
                .id!!
        // 종료된 세션 (다른 작품 — 보존 대상)
        val endedProject = projectRepository.saveAndFlush(Project(userId = userId, title = "종료 작품")).id!!
        val ended =
            workSessionRepository
                .saveAndFlush(
                    WorkSession(
                        userId = userId,
                        projectId = endedProject,
                        startedAt = Instant.now().minusSeconds(20 * 3600),
                        endedAt = Instant.now().minusSeconds(19 * 3600),
                    ),
                ).id!!
        // 최근(1시간 전) 열린 세션 (또 다른 작품 — 보존 대상)
        val recentProject = projectRepository.saveAndFlush(Project(userId = userId, title = "최근 작품")).id!!
        val recent =
            workSessionRepository
                .saveAndFlush(WorkSession(userId = userId, projectId = recentProject, startedAt = Instant.now().minusSeconds(3600)))
                .id!!

        cleanupService.cleanup()

        assertThat(workSessionRepository.findById(stale)).isEmpty() // dangling 폐기
        assertThat(workSessionRepository.findById(ended)).isPresent() // 종료 세션 보존
        assertThat(workSessionRepository.findById(recent)).isPresent() // 최근 열린 세션 보존
    }
}
