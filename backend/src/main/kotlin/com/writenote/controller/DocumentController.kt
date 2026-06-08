package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.model.request.UpdateDocumentTitleRequest
import com.writenote.model.response.DocumentResponse
import com.writenote.model.response.DocumentSaveResponse
import com.writenote.model.response.DocumentTitleResponse
import com.writenote.model.response.Result
import com.writenote.service.DocumentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@Tag(name = "Document", description = "프로젝트 본문 자동저장 / 조회 — owner 식별은 JWT principal 에서만 도출")
@RestController
@SecurityRequirement(name = "BearerJwt")
class DocumentController(
    private val documentService: DocumentService,
) {
    // D1: 프로젝트 ID 로 본문 조회
    @GetMapping("/api/projects/{projectId}/document")
    @Operation(summary = "프로젝트 본문 조회 (nested)", description = "projectId 로 본문 1:1 조회")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 projectId 아님 / 미존재"),
        ],
    )
    fun getDocumentByProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<DocumentResponse> = Result.success(documentService.getDocumentByProjectId(principal.userId, projectId))

    // D2: document ID 로 본문 조회
    @GetMapping("/api/documents/{id}")
    @Operation(summary = "본문 단건 조회", description = "document id 로 조회 (소유권 검증 포함)")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — document 미존재 / 타인 소유"),
        ],
    )
    fun getDocumentById(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): Result<DocumentResponse> = Result.success(documentService.getDocumentById(principal.userId, id))

    // D3: 본문 자동저장 (PUT)
    @PutMapping("/api/documents/{id}")
    @Operation(summary = "본문 자동저장", description = "version 일치 시 body 저장 + word_count 재계산. 불일치 시 409 DOCUMENT_VERSION_CONFLICT")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — {id, body, wordCount, version, updatedAt}"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
            ApiResponse(responseCode = "409", description = "DOCUMENT_VERSION_CONFLICT — {code, message, currentVersion, currentBody}"),
        ],
    )
    fun saveDocument(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @Valid @RequestBody request: SaveDocumentRequest,
    ): Result<DocumentSaveResponse> = Result.success(documentService.saveDocumentById(principal.userId, id, request))

    // D4: title 갱신
    @PatchMapping("/api/documents/{id}/title")
    @Operation(summary = "본문 제목 갱신", description = "title ≤120자")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — {id, title, updatedAt}"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — title 길이 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun updateDocumentTitle(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateDocumentTitleRequest,
    ): Result<DocumentTitleResponse> = Result.success(documentService.updateDocumentTitle(principal.userId, id, request))
}
