package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.error.DocumentConflictException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.model.request.UpdateDocumentTitleRequest
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
        version: Int = 0,
    ): Document =
        Document(
            id = id,
            projectId = projectId,
            title = "제목",
            body = body,
            wordCount = wordCount,
            version = version,
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    // word_count 계산 = ProseMirror JSON text 노드의 텍스트 중 공백 제외 글자 수

    @Test
    @DisplayName("saveDocument — 공백 제외 word_count 계산 후 body + wordCount 갱신 (US1)")
    fun `saveDocument calculates word count excluding spaces`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""
        val document = newDocument(body = Document.EMPTY_DOC_JSON, version = 0)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = body, version = 0)
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
        val document = newDocument(body = Document.EMPTY_DOC_JSON, version = 0)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = body, version = 0)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        // "가나다 " + " 라마바" = 공백 제외 6글자
        assertThat(response.wordCount).isEqualTo(6)
    }

    @Test
    @DisplayName("saveDocument — version 불일치 시 DocumentConflictException (US1 / D3)")
    fun `saveDocument throws DocumentConflictException on version mismatch`() {
        val project = newProject()
        val body = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"신규"}]}]}"""
        val currentBody = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"기존"}]}]}"""
        val document = newDocument(body = currentBody, version = 5)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = body, version = 3)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(DocumentConflictException::class.java)
            .satisfies({ ex ->
                val conflict = ex as DocumentConflictException
                assertThat(conflict.currentVersion).isEqualTo(5)
                assertThat(conflict.currentBody).isEqualTo(currentBody)
            })
    }

    @Test
    @DisplayName("saveDocument — 빈 body 일 때 word_count = 0 (엣지 케이스)")
    fun `saveDocument returns zero word count for empty doc`() {
        val project = newProject()
        val document = newDocument(body = Document.EMPTY_DOC_JSON, version = 0)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = Document.EMPTY_DOC_JSON, version = 0)
        val response = service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)

        assertThat(response.wordCount).isEqualTo(0)
    }

    @Test
    @DisplayName("updateDocumentTitle — title 갱신 후 응답 반환 (D4)")
    fun `updateDocumentTitle persists new title`() {
        val document = newDocument()
        every { documentRepository.findById(eq(100L)) } returns Optional.of(document)
        // ownership 검증을 위해 project 조회
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns newProject()

        val request = UpdateDocumentTitleRequest(title = "새 제목")
        val response = service.updateDocumentTitle(userId = 1L, documentId = 100L, request = request)

        assertThat(response.title).isEqualTo("새 제목")
        assertThat(response.id).isEqualTo(100L)
    }

    @Test
    @DisplayName("getDocumentByProjectId — ownership 검증 후 document 반환 (D1)")
    fun `getDocumentByProjectId returns document after ownership check`() {
        val project = newProject()
        val document = newDocument()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val response = service.getDocumentByProjectId(userId = 1L, projectId = 10L)

        assertThat(response.id).isEqualTo(100L)
        assertThat(response.projectId).isEqualTo(10L)
    }

    @Test
    @DisplayName("getDocumentById — 존재하지 않는 id 시 ResourceNotFoundException (D2)")
    fun `getDocumentById throws ResourceNotFoundException when not found`() {
        every { documentRepository.findById(eq(999L)) } returns Optional.empty()

        assertThatThrownBy {
            service.getDocumentById(userId = 1L, documentId = 999L)
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("saveDocument — body 가 유효한 JSON 이 아니면 ValidationException (D3 / 갭1)")
    fun `saveDocument throws ValidationException on malformed json body`() {
        val project = newProject()
        val document = newDocument(version = 0)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = "{not valid json", version = 0)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("saveDocument — body 가 ProseMirror 문서(type=doc)가 아니면 ValidationException (D3 / 갭1)")
    fun `saveDocument throws ValidationException when body is not a prosemirror doc`() {
        val project = newProject()
        val document = newDocument(version = 0)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { documentRepository.findByProjectId(eq(10L)) } returns Optional.of(document)

        val request = SaveDocumentRequest(body = """{"type":"paragraph","content":[]}""", version = 0)

        assertThatThrownBy {
            service.saveDocument(userId = 1L, projectId = 10L, documentId = null, request = request)
        }.isInstanceOf(ValidationException::class.java)
    }
}
