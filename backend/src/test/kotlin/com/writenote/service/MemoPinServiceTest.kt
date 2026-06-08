package com.writenote.service

import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.Project
import com.writenote.error.ResourceNotFoundException
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Instant
import java.util.Optional

class MemoPinServiceTest {
    private val memoRepository = mockk<MemoRepository>()
    private val memoProjectRepository = mockk<MemoProjectRepository>()
    private val projectRepository = mockk<ProjectRepository>()
    private val service = MemoPinService(memoRepository, memoProjectRepository, projectRepository)

    @BeforeEach
    fun stubSaves() {
        every { memoProjectRepository.saveAndFlush(any<MemoProject>()) } answers { firstArg() }
        every { memoProjectRepository.saveAllAndFlush(any<List<MemoProject>>()) } answers { firstArg() }
    }

    private fun memo(id: Long) = Memo(id = id, userId = 1L, body = "곁쪽지 $id", source = "DESKTOP", capturedAt = Instant.now())

    private fun link(
        id: Long,
        projectId: Long,
        pinned: Boolean,
    ) = MemoProject(id = id, memo = memo(id), projectId = projectId, pinned = pinned)

    @Test
    @DisplayName("pin=true — 작품 내 기존 고정을 해제하고 대상을 고정한다(작품당 1개)")
    fun `pin true unpins existing pinned in same project`() {
        val target = link(id = 20L, projectId = 100L, pinned = false)
        val existing = link(id = 10L, projectId = 100L, pinned = true)
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(Project(id = 100L, userId = 1L))
        every { memoRepository.findByIdAndUserId(20L, 1L) } returns memo(20L)
        every { memoProjectRepository.findByMemoIdAndProjectId(20L, 100L) } returns target
        every { memoProjectRepository.findAllByProjectIdAndPinnedIsTrue(100L) } returns listOf(existing)

        val result = service.setPin(userId = 1L, projectId = 100L, memoId = 20L, pinned = true)

        assertThat(result.pinned).isTrue()
        assertThat(target.pinned).isTrue()
        assertThat(existing.pinned).isFalse()
    }

    @Test
    @DisplayName("pin=false — 대상 고정을 해제한다")
    fun `pin false clears the pin`() {
        val target = link(id = 20L, projectId = 100L, pinned = true)
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.of(Project(id = 100L, userId = 1L))
        every { memoRepository.findByIdAndUserId(20L, 1L) } returns memo(20L)
        every { memoProjectRepository.findByMemoIdAndProjectId(20L, 100L) } returns target

        val result = service.setPin(userId = 1L, projectId = 100L, memoId = 20L, pinned = false)

        assertThat(result.pinned).isFalse()
        assertThat(target.pinned).isFalse()
    }

    @Test
    @DisplayName("작품이 본인 소유가 아니면 404")
    fun `throws when project not owned`() {
        every { projectRepository.findByIdAndUserId(100L, 1L) } returns Optional.empty()

        assertThrows<ResourceNotFoundException> {
            service.setPin(userId = 1L, projectId = 100L, memoId = 20L, pinned = true)
        }
    }
}
