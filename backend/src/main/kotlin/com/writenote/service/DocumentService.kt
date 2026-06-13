package com.writenote.service

import com.writenote.entity.Document
import com.writenote.error.DocumentConflictException
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.model.request.UpdateDocumentTitleRequest
import com.writenote.model.response.DocumentResponse
import com.writenote.model.response.DocumentSaveResponse
import com.writenote.model.response.DocumentTitleResponse
import com.writenote.repository.DocumentRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

@Service
class DocumentService(
    private val documentRepository: DocumentRepository,
    private val projectService: ProjectService,
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

    /** D2: document id 로 조회 (소유권 검증: document.projectId 로 project ownership 확인) */
    @Transactional(readOnly = true)
    fun getDocumentById(
        userId: Long,
        documentId: Long,
    ): DocumentResponse {
        val document =
            documentRepository
                .findById(documentId)
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
     * D3: 본문 자동저장 (documentId 기반 — Controller D3 endpoint 용).
     *
     * document 조회 → projectId 로 소유권 확인 → version 검증 → 저장.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun saveDocumentById(
        userId: Long,
        documentId: Long,
        request: SaveDocumentRequest,
    ): DocumentSaveResponse {
        val document =
            documentRepository
                .findById(documentId)
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

    /** D4: 제목 갱신 (≤120자) */
    @Transactional(rollbackFor = [Exception::class])
    fun updateDocumentTitle(
        userId: Long,
        documentId: Long,
        request: UpdateDocumentTitleRequest,
    ): DocumentTitleResponse {
        val document =
            documentRepository
                .findById(documentId)
                .orElseThrow { ResourceNotFoundException("Document not found: $documentId") }
        projectService.requireOwnedProject(userId, document.projectId)
        document.title = request.title
        return DocumentTitleResponse(
            id = requireNotNull(document.id),
            title = document.title,
            updatedAt = requireNotNull(document.updatedAt),
        )
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
}
