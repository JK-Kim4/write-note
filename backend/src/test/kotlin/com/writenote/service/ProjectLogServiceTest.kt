package com.writenote.service

import com.writenote.entity.Project
import com.writenote.entity.ProjectLog
import com.writenote.error.ResourceNotFoundException
import com.writenote.repository.ProjectLogRepository
import com.writenote.repository.ProjectRepository
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Instant
import java.util.Optional

class ProjectLogServiceTest {
    private val projectLogRepository = mockk<ProjectLogRepository>()
    private val projectRepository = mockk<ProjectRepository>()
    private val service = ProjectLogService(projectLogRepository, projectRepository)

    private fun ownedProject() {
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(Project(id = 100L, userId = 1L))
    }

    @Test
    @DisplayName("create — body 를 trim 하여 저장하고 응답을 반환한다")
    fun `create persists trimmed body`() {
        ownedProject()
        every { projectLogRepository.save(any<ProjectLog>()) } answers {
            firstArg<ProjectLog>().apply {
                id = 5L
                createdAt = Instant.now()
            }
        }

        val result = service.create(userId = 1L, projectId = 100L, body = "  기록  ")

        assertThat(result.id).isEqualTo(5L)
        assertThat(result.body).isEqualTo("기록")
        assertThat(result.projectId).isEqualTo(100L)
    }

    @Test
    @DisplayName("listByProject — 최신순 결과를 응답으로 매핑한다")
    fun `listByProject maps newest-first`() {
        ownedProject()
        every { projectLogRepository.findByProjectIdOrderByCreatedAtDesc(100L) } returns
            listOf(
                ProjectLog(id = 2L, projectId = 100L, body = "새 기록", createdAt = Instant.now()),
                ProjectLog(id = 1L, projectId = 100L, body = "옛 기록", createdAt = Instant.now()),
            )

        val result = service.listByProject(userId = 1L, projectId = 100L)

        assertThat(result.map { it.body }).containsExactly("새 기록", "옛 기록")
    }

    @Test
    @DisplayName("latestByProject — 없으면 null")
    fun `latestByProject returns null when empty`() {
        ownedProject()
        every { projectLogRepository.findFirstByProjectIdOrderByCreatedAtDesc(100L) } returns null

        assertThat(service.latestByProject(userId = 1L, projectId = 100L)).isNull()
    }

    @Test
    @DisplayName("작품이 본인 소유가 아니면 404")
    fun `throws when project not owned`() {
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.empty()

        assertThrows<ResourceNotFoundException> { service.create(userId = 1L, projectId = 100L, body = "x") }
    }
}
