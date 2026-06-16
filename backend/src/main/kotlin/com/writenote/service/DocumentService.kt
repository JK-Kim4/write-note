package com.writenote.service

import com.writenote.components.documents.ChapterReorderValidator
import com.writenote.entity.Document
import com.writenote.error.DocumentConflictException
import com.writenote.error.LastChapterException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.CreateChapterRequest
import com.writenote.model.request.ReorderDocumentsRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.model.request.UpdateDocumentTitleRequest
import com.writenote.model.response.ChapterMetaResponse
import com.writenote.model.response.ChapterResponse
import com.writenote.model.response.DocumentResponse
import com.writenote.model.response.DocumentSaveResponse
import com.writenote.model.response.DocumentTitleResponse
import com.writenote.repository.DocumentRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.time.Instant

@Service
class DocumentService(
    private val documentRepository: DocumentRepository,
    private val projectService: ProjectService,
    private val chapterReorderValidator: ChapterReorderValidator,
) {
    private val jsonMapper: JsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

    /** D1: projectId 로 문서 조회 (소유권 검증 포함) */
    @Transactional(readOnly = true)
    fun getDocumentByProjectId(
        userId: Long,
        projectId: Long,
    ): DocumentResponse {
        projectService.requireOwnedProject(userId, projectId)
        val document =
            documentRepository
                .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
                .firstOrNull()
                ?: throw ResourceNotFoundException("Document not found for project $projectId")
        return document.toResponse()
    }

    /** D2 / C7: document id 로 조회 (소유권 검증 + soft-delete 챕터 404 가드). */
    @Transactional(readOnly = true)
    fun getDocumentById(
        userId: Long,
        documentId: Long,
    ): DocumentResponse {
        // T012: findByIdAndDeletedAtIsNull — 삭제 챕터는 404
        val document =
            documentRepository
                .findByIdAndDeletedAtIsNull(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        return document.toResponse()
    }

    /**
     * D3: 본문 자동저장 (projectId 기반 — 서비스 내부 / 테스트 용).
     *
     * version 불일치 시 [DocumentConflictException] throw.
     * word_count = ProseMirror JSON text 노드 텍스트 합산 (공백 제외).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun saveDocument(
        userId: Long,
        projectId: Long,
        documentId: Long?,
        request: SaveDocumentRequest,
    ): DocumentSaveResponse {
        projectService.requireOwnedProject(userId, projectId)
        val document =
            documentRepository
                .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
                .firstOrNull()
                ?: throw ResourceNotFoundException("Document not found for project $projectId")
        return performSave(document, request)
    }

    /**
     * D3 / C8: 본문 자동저장 (documentId 기반 — Controller D3 endpoint 용).
     *
     * document 조회 → projectId 로 소유권 확인 → version 검증 → 저장.
     * T012: 삭제(soft-delete)된 챕터 저장 시도는 404.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun saveDocumentById(
        userId: Long,
        documentId: Long,
        request: SaveDocumentRequest,
    ): DocumentSaveResponse {
        // T012: findByIdAndDeletedAtIsNull — 삭제 챕터에 저장 불가
        val document =
            documentRepository
                .findByIdAndDeletedAtIsNull(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        return performSave(document, request)
    }

    private fun performSave(
        document: Document,
        request: SaveDocumentRequest,
    ): DocumentSaveResponse {
        // 입력 검증(400) → 상태 검증(409) 순서: 잘못된 body 는 version 과 무관하게 400
        val parsedBody = parseValidProseMirrorDoc(request.body)
        if (document.updatedAt != request.version) {
            throw DocumentConflictException(
                currentVersion = requireNotNull(document.updatedAt),
                currentBody = document.body,
            )
        }
        document.body = request.body
        document.wordCount = countTextChars(parsedBody)

        // datetime 버전 토큰은 +1 예측 불가 → flush 로 Hibernate(@Version)가 set 한 새 updatedAt 을 읽어 응답
        val saved = documentRepository.saveAndFlush(document)
        return DocumentSaveResponse(
            id = requireNotNull(saved.id),
            body = saved.body,
            wordCount = saved.wordCount,
            version = requireNotNull(saved.updatedAt),
            updatedAt = requireNotNull(saved.updatedAt),
        )
    }

    // ── T010: 챕터 목록·생성 ────────────────────────────────────────────────

    /** C1: 활성 챕터 목록 (deletedAt IS NULL), sortOrder ASC. 본문 제외 메타만 반환. */
    @Transactional(readOnly = true)
    fun listChapters(
        userId: Long,
        projectId: Long,
    ): List<ChapterMetaResponse> {
        projectService.requireOwnedProject(userId, projectId)
        return documentRepository
            .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
            .map { it.toMetaResponse() }
    }

    /**
     * C2: 챕터 생성. sortOrder = 활성 챕터 최대값+1 (없으면 0).
     * title 이 null 또는 빈 값이면 "새 챕터" 기본값 사용.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun createChapter(
        userId: Long,
        projectId: Long,
        request: CreateChapterRequest,
    ): ChapterResponse {
        projectService.requireOwnedProject(userId, projectId)
        val activeChapters = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
        val nextSortOrder = if (activeChapters.isEmpty()) 0 else activeChapters.last().sortOrder + 1
        val title = if (request.title.isNullOrBlank()) "새 챕터" else request.title

        val chapter =
            Document(
                projectId = projectId,
                title = title,
                body = Document.EMPTY_DOC_JSON,
                wordCount = 0,
                sortOrder = nextSortOrder,
            )
        val saved = documentRepository.saveAndFlush(chapter)
        return saved.toChapterResponse()
    }

    /**
     * C3: 챕터 순서 일괄 변경. 활성 챕터 id 전량 배열을 받아 배열 index 를 sortOrder 로 대입.
     * [ChapterReorderValidator] 로 누락/중복/외부 id 검증 후 dirty-check 저장.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun reorderChapters(
        userId: Long,
        projectId: Long,
        request: ReorderDocumentsRequest,
    ) {
        projectService.requireOwnedProject(userId, projectId)
        val existing = documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId)
        chapterReorderValidator.validate(request, existing)

        val byId = existing.associateBy { requireNotNull(it.id) }
        request.documentIds.forEachIndexed { index, id ->
            val chapter = requireNotNull(byId[id]) { "chapter $id not found in project $projectId" }
            chapter.sortOrder = index
        }
    }

    /** D4: 제목 갱신 (≤120자) */
    @Transactional(rollbackFor = [Exception::class])
    fun updateDocumentTitle(
        userId: Long,
        documentId: Long,
        request: UpdateDocumentTitleRequest,
    ): DocumentTitleResponse {
        val document =
            documentRepository
                .findByIdAndDeletedAtIsNull(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        // title 은 @Version(본문 version 토큰)을 올리지 않는다 → JPQL bulk update 로 분리(024 거짓 409 방지).
        documentRepository.updateTitleById(documentId, request.title)
        // updatedAt(토큰)은 불변이라 조회 시점 값 그대로 응답. clearAutomatically 로 detached 여도 로드된 값은 접근 가능.
        return DocumentTitleResponse(
            id = requireNotNull(document.id),
            title = request.title,
            updatedAt = requireNotNull(document.updatedAt),
        )
    }

    /**
     * C4: 챕터 soft-delete. [deletedAt] = now(). 활성 챕터가 1개뿐이면 [LastChapterException] (409).
     * 이미 삭제된(또는 존재하지 않는) 챕터면 [ResourceNotFoundException] (404).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun deleteChapter(
        userId: Long,
        documentId: Long,
    ) {
        val document =
            documentRepository
                .findByIdAndDeletedAtIsNull(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        val activeChapters =
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(document.projectId)
        if (activeChapters.size <= 1) {
            throw LastChapterException()
        }
        document.deletedAt = Instant.now()
        documentRepository.save(document)
    }

    /**
     * C5: 삭제된 챕터 복구. [deletedAt] = null. [sortOrder] = 활성 최대+1 (맨 뒤 배치).
     * 삭제 여부와 무관하게 findById 로 조회 후 소유권 확인.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun restoreChapter(
        userId: Long,
        documentId: Long,
    ): ChapterResponse {
        val document =
            documentRepository
                .findById(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        val activeChapters =
            documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(document.projectId)
        val nextSortOrder = if (activeChapters.isEmpty()) 0 else activeChapters.last().sortOrder + 1
        document.deletedAt = null
        document.sortOrder = nextSortOrder
        documentRepository.save(document)
        return document.toChapterResponse()
    }

    /**
     * body 를 유효한 ProseMirror 문서(JSON + type=doc)로 검증. 실패 시 [ValidationException] (400 VALIDATION_FAILED).
     *
     * ProseMirror 는 항상 유효 JSON 을 보내지만, 우회 입력 방어 + contract D3 정합(`contracts/document-endpoints.md`).
     */
    private fun parseValidProseMirrorDoc(body: String): JsonNode {
        val root =
            try {
                jsonMapper.readTree(body)
            } catch (e: Exception) {
                throw ValidationException("본문이 유효한 JSON 형식이 아닙니다")
            }
        val typeNode = root.path("type")
        if (!typeNode.isTextual || typeNode.asText() != "doc") {
            throw ValidationException("본문이 유효한 ProseMirror 문서가 아닙니다 (type=doc 필요)")
        }
        return root
    }

    /** ProseMirror 문서 노드에서 text 를 재귀 추출하여 공백 제외 글자 수 계산. */
    private fun countTextChars(root: JsonNode): Int =
        extractTextFromNode(root)
            .filter { c -> c != ' ' && c != '\t' && c != '\n' && c != '\r' }
            .length

    private fun extractTextFromNode(node: JsonNode): String {
        val typeNode = node.path("type")
        val type = if (typeNode.isTextual) typeNode.asText() else ""
        if (type == "text") {
            val textNode = node.path("text")
            return if (textNode.isTextual) textNode.asText() else ""
        }
        val content = node.path("content")
        if (content.isArray) {
            return content.joinToString("") { extractTextFromNode(it) }
        }
        return ""
    }

    private fun Document.toResponse() =
        DocumentResponse(
            id = requireNotNull(id),
            projectId = projectId,
            title = title,
            body = body,
            wordCount = wordCount,
            version = requireNotNull(updatedAt),
            updatedAt = requireNotNull(updatedAt),
        )

    private fun Document.toMetaResponse() =
        ChapterMetaResponse(
            id = requireNotNull(id),
            title = title,
            sortOrder = sortOrder,
            wordCount = wordCount,
            updatedAt = requireNotNull(updatedAt),
        )

    private fun Document.toChapterResponse() =
        ChapterResponse(
            id = requireNotNull(id),
            title = title,
            sortOrder = sortOrder,
            body = body,
            wordCount = wordCount,
            updatedAt = requireNotNull(updatedAt),
        )
}
