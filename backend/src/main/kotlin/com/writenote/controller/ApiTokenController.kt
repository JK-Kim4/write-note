package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateApiTokenRequest
import com.writenote.model.request.UpdateApiTokenRequest
import com.writenote.model.response.ApiTokenCreatedResponse
import com.writenote.model.response.ApiTokenResponse
import com.writenote.model.response.Result
import com.writenote.service.ApiTokenService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/api-tokens")
@Tag(name = "API 토큰", description = "모바일 캡처용 장기 API 토큰 발급·목록·수정·해지")
@SecurityRequirement(name = "BearerJwt")
class ApiTokenController(
    private val apiTokenService: ApiTokenService,
) {
    /**
     * T1. POST /api/api-tokens — 새 토큰 발급.
     *
     * 응답의 `token` 필드(평문 원본)는 본 응답에서만 1회 노출.
     * 이후 서버에서 원본 조회 불가 — DB 에는 SHA-256 hash 만 저장.
     */
    @PostMapping
    @Operation(
        summary = "API 토큰 발급",
        description = "wnt_ + base62 32자 생성 → hash 저장. 응답의 token 은 본 응답에서만 1회 노출.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "발급 성공 — token 은 이 응답에서만 1회 반환"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — label 120자 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_MISSING / INVALID / EXPIRED"),
        ],
    )
    fun createToken(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateApiTokenRequest,
    ): ResponseEntity<Result<ApiTokenCreatedResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(apiTokenService.createToken(principal.userId, request)))

    /**
     * T2. GET /api/api-tokens — 본인 토큰 목록.
     *
     * 활성+해지 모두 반환 (revokedAt 으로 구분). 원본 token 미포함.
     */
    @GetMapping
    @Operation(
        summary = "API 토큰 목록",
        description = "본인 토큰 전체 (활성+해지). revokedAt null = 활성. 원본 token 미포함.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun listTokens(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): Result<List<ApiTokenResponse>> = Result.success(apiTokenService.listTokens(principal.userId))

    /**
     * T3. PATCH /api/api-tokens/{id} — label 변경.
     */
    @PatchMapping("/{tokenId}")
    @Operation(summary = "API 토큰 label 변경", description = "본인 토큰만. 타인·미존재 시 404.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — label 비어있음 / 120자 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun updateLabel(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable tokenId: Long,
        @Valid @RequestBody request: UpdateApiTokenRequest,
    ): Result<ApiTokenResponse> = Result.success(apiTokenService.updateLabel(principal.userId, tokenId, request))

    /**
     * T4. DELETE /api/api-tokens/{id} — 해지.
     *
     * revoked_at = now(). DB row 유지 (감사 목적).
     * 이후 해당 토큰으로 /api/capture 호출 시 ApiTokenAuthenticationFilter 가 거부.
     */
    @DeleteMapping("/{tokenId}")
    @Operation(
        summary = "API 토큰 해지",
        description = "revoked_at = now() 박음. DB row 유지. 이후 /api/capture 거부 (filter 검증).",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "204", description = "해지 성공 — body 없음"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 타인 토큰 또는 미존재"),
        ],
    )
    fun revokeToken(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable tokenId: Long,
    ): ResponseEntity<Void> {
        apiTokenService.revokeToken(principal.userId, tokenId)
        return ResponseEntity.noContent().build()
    }
}
