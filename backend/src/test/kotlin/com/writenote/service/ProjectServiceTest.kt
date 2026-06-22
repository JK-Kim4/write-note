package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.entity.WorkSession
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.CategoryRepository
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
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var service: ProjectService

    @BeforeEach
    fun setUp() {
        projectRepository = mockk()
        userRepository = mockk()
        projectMapper = mockk()
        documentRepository = mockk()
        workSessionRepository = mockk()
        categoryRepository = mockk()
        service =
            ProjectService(
                projectRepository,
                userRepository,
                projectMapper,
                documentRepository,
                workSessionRepository,
                categoryRepository,
            )
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
                paperSize = project.paperSize,
                layoutMode = project.layoutMode,
                fontScale = project.fontScale,
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
    @DisplayName("createProject — paperSize 허용값 영속, 미지정 시 A4")
    fun `createProject persists paperSize and defaults to A4`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { documentRepository.save(any<Document>()) } answers { firstArg() }
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val withPaper = slot<Project>()
        every { projectRepository.save(capture(withPaper)) } answers { firstArg<Project>().apply { id = 100L } }
        service.createProject(1L, CreateProjectRequest(title = "T", paperSize = "B4"))
        assertThat(withPaper.captured.paperSize).isEqualTo("B4")

        val noPaper = slot<Project>()
        every { projectRepository.save(capture(noPaper)) } answers { firstArg<Project>().apply { id = 101L } }
        service.createProject(1L, CreateProjectRequest(title = "T2"))
        assertThat(noPaper.captured.paperSize).isEqualTo("A4")
    }

    @Test
    @DisplayName("createProject — 비허용 paperSize 는 ValidationException")
    fun `createProject rejects unknown paperSize`() {
        every { userRepository.existsById(eq(1L)) } returns true
        assertThatThrownBy { service.createProject(1L, CreateProjectRequest(title = "T", paperSize = "A5")) }
            .isInstanceOf(ValidationException::class.java)
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

    // ── 032 모음 이동 moveCategory ───────────────────────────────────────────

    @Test
    @DisplayName("moveCategory — 본인 모음 지정 시 categoryId 설정")
    fun `moveCategory sets categoryId when category owned`() {
        val project =
            Project(id = 5L, userId = 1L, title = "x", createdAt = Instant.now(), updatedAt = Instant.now())
        every { projectRepository.findByIdAndUserId(eq(5L), eq(1L)) } returns Optional.of(project)
        every { categoryRepository.existsByIdAndUserId(eq(9L), eq(1L)) } returns true
        every { projectMapper.toResponse(eq(project)) } answers { stubMapper(project) }

        service.moveCategory(userId = 1L, projectId = 5L, categoryId = 9L)

        assertThat(project.categoryId).isEqualTo(9L)
    }

    @Test
    @DisplayName("moveCategory — categoryId null 이면 미분류(null)로 빼냄")
    fun `moveCategory clears categoryId when null`() {
        val project =
            Project(id = 5L, userId = 1L, title = "x", categoryId = 9L, createdAt = Instant.now(), updatedAt = Instant.now())
        every { projectRepository.findByIdAndUserId(eq(5L), eq(1L)) } returns Optional.of(project)
        every { projectMapper.toResponse(eq(project)) } answers { stubMapper(project) }

        service.moveCategory(userId = 1L, projectId = 5L, categoryId = null)

        assertThat(project.categoryId).isNull()
    }

    @Test
    @DisplayName("moveCategory — 본인 작품 아니면 ResourceNotFoundException")
    fun `moveCategory rejects non-owned project`() {
        every { projectRepository.findByIdAndUserId(eq(99L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy { service.moveCategory(userId = 1L, projectId = 99L, categoryId = 9L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("moveCategory — 남의/없는 모음 지정 시 ResourceNotFoundException")
    fun `moveCategory rejects unknown category`() {
        val project =
            Project(id = 5L, userId = 1L, title = "x", createdAt = Instant.now(), updatedAt = Instant.now())
        every { projectRepository.findByIdAndUserId(eq(5L), eq(1L)) } returns Optional.of(project)
        every { categoryRepository.existsByIdAndUserId(eq(77L), eq(1L)) } returns false

        assertThatThrownBy { service.moveCategory(userId = 1L, projectId = 5L, categoryId = 77L) }
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
        id: Long = projectId * 10,
        deletedAt: Instant? = null,
    ) = Document(
        id = id,
        projectId = projectId,
        wordCount = wordCount,
        createdAt = updatedAt,
        updatedAt = updatedAt,
        deletedAt = deletedAt,
    )

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
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L, 200L))) } returns
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
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L))) } returns
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

    // ── T031 챕터 합산 listCards ─────────────────────────────────────────────

    @Test
    @DisplayName("listCards — 활성 챕터 여럿일 때 wordCount 합산·documentUpdatedAt 최신값")
    fun `listCards aggregates wordCount sum and latest updatedAt across chapters`() {
        val older = Instant.parse("2026-06-10T00:00:00Z")
        val newer = Instant.parse("2026-06-12T10:00:00Z")
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(100L, "소설A"))
        // 작품 100에 활성 챕터 3개
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L))) } returns
            listOf(
                docOf(100L, wordCount = 1000, updatedAt = older, id = 1001L),
                docOf(100L, wordCount = 2500, updatedAt = newer, id = 1002L),
                docOf(100L, wordCount = 500, updatedAt = older, id = 1003L),
            )
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(1)
        val card = cards[0]
        // wordCount = 1000 + 2500 + 500 = 4000
        assertThat(card.wordCount).isEqualTo(4000)
        // documentUpdatedAt = 세 챕터 중 최신 updated_at
        assertThat(card.documentUpdatedAt).isEqualTo(newer)
    }

    @Test
    @DisplayName("listCards — 삭제(deletedAt) 챕터는 합산에서 제외 (findByProjectIdInAndDeletedAtIsNull 계약)")
    fun `listCards excludes soft-deleted chapters from aggregation`() {
        // findByProjectIdInAndDeletedAtIsNull 가 활성 챕터만 반환하는 계약이므로,
        // 삭제 챕터가 결과에 포함되지 않음을 서비스가 groupBy 로 올바르게 합산하는지 검증한다.
        val t1 = Instant.parse("2026-06-10T00:00:00Z")
        val t2 = Instant.parse("2026-06-11T00:00:00Z")
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns
            listOf(activeProject(200L, "소설B"), activeProject(300L, "소설C"))
        // 200 = 활성 챕터 2개, 300 = 활성 챕터 1개
        every {
            documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(200L, 300L)))
        } returns
            listOf(
                docOf(200L, wordCount = 3000, updatedAt = t1, id = 2001L),
                docOf(200L, wordCount = 700, updatedAt = t2, id = 2002L),
                docOf(300L, wordCount = 1200, updatedAt = t1, id = 3001L),
            )
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(200L, 300L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(2)
        val b = cards.first { it.id == 200L }
        assertThat(b.wordCount).isEqualTo(3700) // 3000 + 700
        assertThat(b.documentUpdatedAt).isEqualTo(t2) // 최신
        val c = cards.first { it.id == 300L }
        assertThat(c.wordCount).isEqualTo(1200)
        assertThat(c.documentUpdatedAt).isEqualTo(t1)
    }

    @Test
    @DisplayName("listCards — 챕터 합산 시 repository 호출 수가 4회 고정 (N+1 금지)")
    fun `listCards makes exactly 4 repository calls regardless of chapter count`() {
        val t = Instant.parse("2026-06-10T00:00:00Z")
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(100L, "소설"))
        // 챕터 4개 — 호출 수 증가 없어야 함
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L))) } returns
            listOf(
                docOf(100L, wordCount = 100, updatedAt = t, id = 1001L),
                docOf(100L, wordCount = 200, updatedAt = t, id = 1002L),
                docOf(100L, wordCount = 300, updatedAt = t, id = 1003L),
                docOf(100L, wordCount = 400, updatedAt = t, id = 1004L),
            )
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        service.listCards(userId = 1L)

        // 4쿼리 일괄: existsById(user) / findByUserIdAndArchivedAtIsNull / findByProjectIdInAndDeletedAtIsNull / findByProjectIdInAndEndedAtIsNotNull
        verify(exactly = 1) { userRepository.existsById(eq(1L)) }
        verify(exactly = 1) { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) }
        verify(exactly = 1) { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L))) }
        verify(exactly = 1) { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L))) }
    }

    // ── T031 보강 — lastSentenceSource: 최신 챕터 body ──────────────────────

    private fun docWithBody(
        projectId: Long,
        wordCount: Int,
        updatedAt: Instant,
        body: String,
        id: Long,
    ) = Document(
        id = id,
        projectId = projectId,
        wordCount = wordCount,
        body = body,
        createdAt = updatedAt,
        updatedAt = updatedAt,
    )

    @Test
    @DisplayName("listCards — lastSentenceSource 는 max updatedAt 활성 챕터 body 의 plainText")
    fun `listCards lastSentenceSource comes from max updatedAt chapter`() {
        val older = Instant.parse("2026-06-10T00:00:00Z")
        val newer = Instant.parse("2026-06-12T10:00:00Z")
        val olderBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 챕터 내용"}]}]}"""
        val newerBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"최신 챕터 내용"}]}]}"""
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(100L, "소설"))
        // sortOrder=0 챕터가 오래된 updatedAt, sortOrder=1 챕터가 최신 updatedAt
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(100L))) } returns
            listOf(
                docWithBody(100L, wordCount = 100, updatedAt = older, body = olderBody, id = 1001L),
                docWithBody(100L, wordCount = 200, updatedAt = newer, body = newerBody, id = 1002L),
            )
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(100L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(1)
        // 최신 챕터(newer updatedAt)의 plainText 가 lastSentenceSource 로 와야 함
        assertThat(cards[0].lastSentenceSource).isEqualTo("최신 챕터 내용")
        // 오래된 챕터의 텍스트는 포함되면 안 됨
        assertThat(cards[0].lastSentenceSource).doesNotContain("첫 챕터 내용")
    }

    @Test
    @DisplayName("listCards — 삭제된 챕터는 lastSentenceSource 에 포함되지 않는다")
    fun `listCards lastSentenceSource excludes deleted chapters`() {
        val t1 = Instant.parse("2026-06-10T00:00:00Z")
        val t2 = Instant.parse("2026-06-11T00:00:00Z")
        // findByProjectIdInAndDeletedAtIsNull 계약: 삭제 챕터는 결과에 없음
        // 여기서는 활성 챕터 1개만 반환하여 deleted 챕터가 제외됨을 검증
        val activeBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"활성 챕터"}]}]}"""
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(200L, "소설B"))
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(200L))) } returns
            listOf(docWithBody(200L, wordCount = 50, updatedAt = t1, body = activeBody, id = 2001L))
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(200L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(1)
        assertThat(cards[0].lastSentenceSource).isEqualTo("활성 챕터")
    }

    @Test
    @DisplayName("listCards — 챕터 없으면 lastSentenceSource 빈 문자열")
    fun `listCards lastSentenceSource is empty when no chapters`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { projectRepository.findByUserIdAndArchivedAtIsNull(eq(1L)) } returns listOf(activeProject(300L, "소설C"))
        every { documentRepository.findByProjectIdInAndDeletedAtIsNull(eq(listOf(300L))) } returns emptyList()
        every { workSessionRepository.findByProjectIdInAndEndedAtIsNotNull(eq(listOf(300L))) } returns emptyList()
        every { projectMapper.toResponse(any()) } answers { stubMapper(firstArg<Project>()) }

        val cards = service.listCards(userId = 1L)

        assertThat(cards).hasSize(1)
        assertThat(cards[0].lastSentenceSource).isEmpty()
    }
}
