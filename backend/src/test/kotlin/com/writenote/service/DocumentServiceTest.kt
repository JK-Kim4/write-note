package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.error.DocumentConflictException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

class DocumentServiceTest {
    private lateinit var documentRepository: DocumentRepository
    private lateinit var projectService: ProjectService
    private lateinit var service: DocumentService

    companion object {
        // 세션이 소유한 버전 토큰(= document.updatedAt). flush 전 기준값.
        private val BASE_VERSION: Instant = Instant.parse("2026-06-09T00:00:00Z")

        // flush 후 Hibernate(@Version)가 set 한 새 updatedAt 모사값(예측 불가한 다음 시각).
        private val ADVANCED_VERSION: Instant = Instant.parse("2026-06-09T00:00:10.123456Z")
    }

    @BeforeEach
    fun setUp() {
        documentRepository = mockk()
        projectService = mockk()
        service = DocumentService(documentRepository, projectService)
    }

    private fun newProject(
        userId: Long = 1L,
        projectId: Long = 10L,
    ): Project =
        Project(
            id = projectId,
            userId = userId,
            title = "x",
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    private fun newDocument(
        id: Long = 100L,
        projectId: Long = 10L,
        body: String = Document.EMPTY_DOC_JSON,
        wordCount: Int = 0,
        updatedAt: Instant = BASE_VERSION,
    ): Document =
        Document(
            id = id,
            projectId = projectId,
            title = "제목",
            body = body,
            wordCount = wordCount,
            createdAt = Instant.now(),
            updatedAt = updatedAt,
        )

    /** flush 시 Hibernate(@Version)가 updatedAt 을 새 시각으로 set 하는 동작을 mock 으로 모사. */
    private fun stubSaveAndFlushBumpingVersion(to: Instant = ADVANCED_VERSION) {
        every { documentRepository.saveAndFlush(any<Document>()) } answers
            {
                val saved = firstArg<Document>()
                saved.updatedAt = to
                saved
            }
    }

    // word_count 계산 = ProseMirror JSON text 노드의 텍스트 중 공백 제외 글자 수

    @Test
    @DisplayName("saveDocument — 공백 제외 word_count 계산 후 body + wordCount 갱신 (US1)")
    fun `saveDocument calculates word count excluding spaces`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""
        val document = newDocument(body = Document.EMPTY_DOC_JSON, updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)
        stubSaveAndFlushBumpingVersion()

        val request = SaveDocumentRequest(body = body, version = BASE_VERSION)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        // "안녕 세계" = 공백 제외 4글자
        assertThat(response.wordCount).isEqualTo(4)
        assertThat(response.body).isEqualTo(body)
    }

    @Test
    @DisplayName("saveDocument — 한 문서에 여러 text 노드가 있을 때 합산 (US1)")
    fun `saveDocument sums text across multiple text nodes`() {
        val project = newProject()
        val body =
            """
            {"type":"doc","content":[
              {"type":"paragraph","content":[{"type":"text","text":"가나다 "}]},
              {"type":"paragraph","content":[{"type":"text","text":" 라마바"}]}
            ]}
            """.trimIndent()
        val document = newDocument(body = Document.EMPTY_DOC_JSON, updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)
        stubSaveAndFlushBumpingVersion()

        val request = SaveDocumentRequest(body = body, version = BASE_VERSION)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        // "가나다 " + " 라마바" = 공백 제외 6글자
        assertThat(response.wordCount).isEqualTo(6)
    }

    @Test
    @DisplayName("saveDocument — version(updatedAt 토큰) 불일치 시 DocumentConflictException (US1 / D3)")
    fun `saveDocument throws DocumentConflictException on version mismatch`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"신규"}]}]}"""
        val currentBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"기존"}]}]}"""
        // 서버 현재 토큰 = ADVANCED_VERSION, 클라이언트가 보낸 토큰 = BASE_VERSION(과거) → 불일치
        val document = newDocument(body = currentBody, updatedAt = ADVANCED_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)

        val request = SaveDocumentRequest(body = body, version = BASE_VERSION)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(DocumentConflictException::class.java)
            .satisfies({ ex ->
                val conflict = ex as DocumentConflictException
                assertThat(conflict.currentVersion).isEqualTo(ADVANCED_VERSION)
                assertThat(conflict.currentBody).isEqualTo(currentBody)
            })
    }

    @Test
    @DisplayName("saveDocument — version 일치 시 저장 후 flush 된 새 updatedAt 을 version 으로 응답 (US1 / D3 / R6)")
    fun `saveDocument returns flushed new updatedAt as version on match`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"본문"}]}]}"""
        val document = newDocument(body = Document.EMPTY_DOC_JSON, updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)
        stubSaveAndFlushBumpingVersion(to = ADVANCED_VERSION)

        val request = SaveDocumentRequest(body = body, version = BASE_VERSION)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        // 응답 version 은 flush 후 확정된 새 updatedAt — 요청 토큰(BASE)이 아니라 ADVANCED
        assertThat(response.version).isEqualTo(ADVANCED_VERSION)
        assertThat(response.version).isNotEqualTo(BASE_VERSION)
        assertThat(response.updatedAt).isEqualTo(ADVANCED_VERSION)
    }

    @Test
    @DisplayName("saveDocument — 저장 성공 후 동일(과거) 토큰 재요청 시 충돌 (US1 / D3 stale token)")
    fun `saveDocument conflicts when stale token re-sent after version advanced`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"본문"}]}]}"""
        val document = newDocument(body = Document.EMPTY_DOC_JSON, updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)
        stubSaveAndFlushBumpingVersion(to = ADVANCED_VERSION)

        // 1차 저장: BASE 토큰 일치 → 성공, document.updatedAt 이 ADVANCED 로 전진
        service.saveDocument(
            userId = 1L,
            projectId = 10L,
            documentId = null,
            request = SaveDocumentRequest(body = body, version = BASE_VERSION),
        )

        // 2차 저장: 동일한 과거 토큰(BASE) 재사용 → 이제 서버 토큰은 ADVANCED 라 충돌
        assertThatThrownBy {
            service.saveDocument(
                userId = 1L,
                projectId = 10L,
                documentId = null,
                request = SaveDocumentRequest(body = body, version = BASE_VERSION),
            )
        }.isInstanceOf(DocumentConflictException::class.java)
            .satisfies({ ex ->
                assertThat((ex as DocumentConflictException).currentVersion).isEqualTo(ADVANCED_VERSION)
            })
    }

    @Test
    @DisplayName("saveDocument — 빈 body 일 때 word_count = 0 (엣지 케이스)")
    fun `saveDocument returns zero word count for empty doc`() {
        val project = newProject()
        val document = newDocument(body = Document.EMPTY_DOC_JSON, updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)
        stubSaveAndFlushBumpingVersion()

        val request = SaveDocumentRequest(body = Document.EMPTY_DOC_JSON, version = BASE_VERSION)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        assertThat(response.wordCount).isEqualTo(0)
    }

    @Test
    @DisplayName("getDocumentByProjectId — ownership 검증 후 document 반환 (D1)")
    fun `getDocumentByProjectId returns document after ownership check`() {
        val project = newProject()
        val document = newDocument()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)

        val response = service.getDocumentByProjectId(userId = 1L, projectId = 10L)

        assertThat(response.id).isEqualTo(100L)
        assertThat(response.projectId).isEqualTo(10L)
    }

    @Test
    @DisplayName("getDocumentById — 존재하지 않는 id 시 ResourceNotFoundException (D2 / T012)")
    fun `getDocumentById throws ResourceNotFoundException when not found`() {
        // T012: findByIdAndDeletedAtIsNull 기반 — 없거나 soft-delete 된 경우 모두 404
        every { documentRepository.findByIdAndDeletedAtIsNull(eq(999L)) } returns Optional.empty()

        assertThatThrownBy {
            service.getDocumentById(userId = 1L, documentId = 999L)
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("saveDocument — body 가 유효한 JSON 이 아니면 ValidationException (D3 / 갭1)")
    fun `saveDocument throws ValidationException on malformed json body`() {
        val project = newProject()
        val document = newDocument(updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)

        val request = SaveDocumentRequest(body = "{not valid json", version = BASE_VERSION)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("saveDocument — body 가 ProseMirror 문서(type=doc)가 아니면 ValidationException (D3 / 갭1)")
    fun `saveDocument throws ValidationException when body is not a prosemirror doc`() {
        val project = newProject()
        val document = newDocument(updatedAt = BASE_VERSION)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(eq(10L))
        } returns listOf(document)

        val request = SaveDocumentRequest(body = """{"type":"paragraph","content":[]}""", version = BASE_VERSION)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(ValidationException::class.java)
    }
}
