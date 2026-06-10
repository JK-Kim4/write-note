package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.entity.WorkSession
import com.writenote.error.ResourceNotFoundException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.WorkSessionRepository
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
    private lateinit var workSessionRepository: WorkSessionRepository
    private lateinit var service: ProjectService

    @BeforeEach
    fun setUp() {
        projectRepository = mockk()
        userRepository = mockk()
        projectMapper = mockk()
        documentRepository = mockk()
        workSessionRepository = mockk()
        service = ProjectService(projectRepository, userRepository, projectMapper, documentRepository, workSessionRepository)
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

    // ── 018 카드 집계 listCards ──────────────────────────────────────────────

    private fun activeProject(
        id: Long,
        title: String,
    ) = Project(id = id, userId = 1L, title = title, createdAt = Instant.now(), updatedAt = Instant.now())

    private fun docOf(
        projectId: Long,
        wordCount: Int,
        updatedAt: Instant,
    ) = Document(id = projectId * 10, projectId = projectId, wordCount = wordCount, createdAt = updatedAt, updatedAt = updatedAt)

    private fun endedSession(
        projectId: Long,
        startedAt: Instant,
        durationMs: Long,
    ) = WorkSession(projectId = projectId, startedAt = startedAt, endedAt = startedAt.plusMillis(durationMs))

    @Test
    @DisplayName("listCards — 활성 작품에 문서 글자수·저장 시각과 종료 세션 합을 조립한다")
    fun `listCards assembles document and session aggregates`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns
            listOf(activeProject(100L, "여름의 끝"), activeProject(200L, "파란색의 온도"))
        every { documentRepository.findByProjectIdIn(eq(listOf(100L, 200L))) } returns
            listOf(
                docOf(100L, wordCount = 42500, updatedAt = Instant.parse("2026-06-10T02:00:00Z")),
                docOf(200L, wordCount = 1000, updatedAt = Instant.parse("2026-06-01T00:00:00Z")),
            )
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L, 200L))) } returns
            listOf(
                endedSession(100L, Instant.parse("2026-06-09T10:00:00Z"), durationMs = 1_200_000L),
                endedSession(100L, Instant.parse("2026-06-09T12:00:00Z"), durationMs = 600_000L),
            )
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(2)
        val first = cards.first { it.id == 100L }
        assertThat(first.title).isEqualTo("여름의 끝")
        assertThat(first.wordCount).isEqualTo(42500)
        assertThat(first.documentUpdatedAt).isEqualTo(Instant.parse("2026-06-10T02:00:00Z"))
        assertThat(first.totalDurationMs).isEqualTo(1_800_000L)
        val second = cards.first { it.id == 200L }
        assertThat(second.wordCount).isEqualTo(1000)
        assertThat(second.totalDurationMs).isEqualTo(0L)
    }

    @Test
    @DisplayName("listCards — 세션 없는 새 작품은 글자수·누적 0 으로 응답한다(오류 아님)")
    fun `listCards returns zero aggregates for fresh project`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(100L, "새 작품"))
        every { documentRepository.findByProjectIdIn(eq(listOf(100L))) } returns
            listOf(docOf(100L, wordCount = 0, updatedAt = Instant.parse("2026-06-10T00:00:00Z")))
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(1)
        assertThat(cards[0].wordCount).isEqualTo(0)
        assertThat(cards[0].totalDurationMs).isEqualTo(0L)
    }

    @Test
    @DisplayName("listCards — 활성 작품이 없으면 빈 목록")
    fun `listCards returns empty list when no active project`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns emptyList()

        assertThat(service.listCards(userId = 1L)).isEmpty()
    }

    @Test
    @DisplayName("listCards — 존재하지 않는 사용자는 ResourceNotFoundException")
    fun `listCards rejects unknown user`() {
        every { userRepository.existsById(eq(9L)) } returns false

        assertThatThrownBy { service.listCards(userId = 9L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }
}
