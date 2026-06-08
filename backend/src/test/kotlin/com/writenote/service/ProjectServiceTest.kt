package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.error.ResourceNotFoundException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

class ProjectServiceTest {
    private lateinit var projectRepository: ProjectRepository
    private lateinit var userRepository: UserRepository
    private lateinit var projectMapper: ProjectMapper
    private lateinit var documentRepository: DocumentRepository
    private lateinit var service: ProjectService

    @BeforeEach
    fun setUp() {
        projectRepository = mockk()
        userRepository = mockk()
        projectMapper = mockk()
        documentRepository = mockk()
        service = ProjectService(projectRepository, userRepository, projectMapper, documentRepository)
    }

    private fun stubMapper(project: Project): ProjectResponse {
        val response =
            ProjectResponse(
                id = project.id ?: 999L,
                title = project.title,
                genre = project.genre,
                targetLength = project.targetLength,
                toneNotes = project.toneNotes,
                synopsis = project.synopsis,
                worldNotes = project.worldNotes,
                nextScene = project.nextScene,
                archivedAt = project.archivedAt,
                createdAt = project.createdAt ?: Instant.now(),
                updatedAt = project.updatedAt ?: Instant.now(),
            )
        every { projectMapper.toResponse(eq(project)) } returns response
        return response
    }

    @Test
    @DisplayName("createProject — 메타 5 필드 모두 영속")
    fun `createProject persists all metadata fields`() {
        every { userRepository.existsById(eq(1L)) } returns true
        val captured = slot<Project>()
        every { projectRepository.save(capture(captured)) } answers { firstArg<Project>().apply { id = 100L } }
        every { documentRepository.save(any<Document>()) } answers { firstArg() }

        val request =
            CreateProjectRequest(
                title = "  Padded  ",
                genre = "치유물",
                targetLength = 4000,
                toneNotes = "잔잔",
                synopsis = "할머니",
                worldNotes = "1990s",
            )

        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }
        service.createProject(1L, request)

        val saved = captured.captured
        assertThat(saved.userId).isEqualTo(1L)
        assertThat(saved.title).isEqualTo("Padded")
        assertThat(saved.genre).isEqualTo("치유물")
        assertThat(saved.targetLength).isEqualTo(4000)
        assertThat(saved.toneNotes).isEqualTo("잔잔")
        assertThat(saved.synopsis).isEqualTo("할머니")
        assertThat(saved.worldNotes).isEqualTo("1990s")
    }

    @Test
    @DisplayName("createProject — documentRepository.save 가 같은 projectId 로 호출됨 (US3 / FR-009)")
    fun `createProject auto-provisions document with same projectId`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.save(any()) } answers { firstArg<Project>().apply { id = 100L } }
        val capturedDoc = slot<Document>()
        every { documentRepository.save(capture(capturedDoc)) } answers { firstArg() }
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        service.createProject(1L, CreateProjectRequest(title = "test"))

        verify(exactly = 1) { documentRepository.save(match<Document> { it.projectId == 100L }) }
        assertThat(capturedDoc.captured.projectId).isEqualTo(100L)
    }

    @Test
    @DisplayName("updateProject — null 필드는 미변경, 명시값은 갱신")
    fun `updateProject only mutates specified fields`() {
        val existing =
            Project(
                id = 7L,
                userId = 2L,
                title = "Old title",
                genre = "치유물",
                targetLength = 1000,
                toneNotes = "Old tone",
                synopsis = "Old synopsis",
                worldNotes = "Old world",
                createdAt = Instant.now(),
                updatedAt = Instant.now(),
            )
        every { projectRepository.findByIdAndUserId(eq(7L), eq(2L)) } returns Optional.of(existing)
        every { projectMapper.toResponse(eq(existing)) } answers { stubMapper(existing) }

        service.updateProject(
            userId = 2L,
            projectId = 7L,
            request =
                UpdateProjectRequest(
                    toneNotes = "New tone",
                    synopsis = null,
                ),
        )

        assertThat(existing.title).isEqualTo("Old title")
        assertThat(existing.genre).isEqualTo("치유물")
        assertThat(existing.targetLength).isEqualTo(1000)
        assertThat(existing.toneNotes).isEqualTo("New tone")
        assertThat(existing.synopsis).isEqualTo("Old synopsis")
        assertThat(existing.worldNotes).isEqualTo("Old world")
    }

    @Test
    @DisplayName("archiveProject — archivedAt 박힘, 두 번째 호출은 시각 유지 (멱등)")
    fun `archiveProject is idempotent`() {
        val firstArchive = Instant.parse("2026-05-25T10:00:00Z")
        val project =
            Project(
                id = 11L,
                userId = 3L,
                title = "x",
                archivedAt = firstArchive,
                createdAt = Instant.now(),
                updatedAt = Instant.now(),
            )
        every { projectRepository.findByIdAndUserId(eq(11L), eq(3L)) } returns Optional.of(project)
        every { projectMapper.toResponse(eq(project)) } answers { stubMapper(project) }

        service.archiveProject(3L, 11L)

        assertThat(project.archivedAt).isEqualTo(firstArchive)
    }

    @Test
    @DisplayName("unarchiveProject — archivedAt 가 null 로 박힘")
    fun `unarchiveProject clears archivedAt`() {
        val project =
            Project(
                id = 12L,
                userId = 3L,
                title = "x",
                archivedAt = Instant.now(),
                createdAt = Instant.now(),
                updatedAt = Instant.now(),
            )
        every { projectRepository.findByIdAndUserId(eq(12L), eq(3L)) } returns Optional.of(project)
        every { projectMapper.toResponse(eq(project)) } answers { stubMapper(project) }

        service.unarchiveProject(3L, 12L)

        assertThat(project.archivedAt).isNull()
    }

    @Test
    @DisplayName("deleteProject — Repository.delete 호출 후 DB FK CASCADE 위임")
    fun `deleteProject delegates to repository delete`() {
        val project =
            Project(
                id = 13L,
                userId = 4L,
                title = "x",
                createdAt = Instant.now(),
                updatedAt = Instant.now(),
            )
        every { projectRepository.findByIdAndUserId(eq(13L), eq(4L)) } returns Optional.of(project)
        every { projectRepository.delete(eq(project)) } returns Unit

        service.deleteProject(4L, 13L)

        verify(exactly = 1) { projectRepository.delete(eq(project)) }
    }

    @Test
    @DisplayName("cross user 접근 — findByIdAndUserId 가 empty 일 때 ResourceNotFoundException")
    fun `archive throws ResourceNotFoundException for non-owner`() {
        every { projectRepository.findByIdAndUserId(eq(99L), eq(5L)) } returns Optional.empty()

        assertThatThrownBy { service.archiveProject(5L, 99L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }
}
