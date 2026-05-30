package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.components.IdempotencyCache
import com.writenote.model.request.MobileCaptureRequest
import com.writenote.model.response.MemoResponse
import com.writenote.model.response.Result
import com.writenote.service.MemoService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.ObjectMapper

/**
 * 모바일 캡처 엔드포인트 (ApiToken 인증).
 *
 * M6 POST /api/capture — Idempotency-Key 헤더로 5분 멱등성 보장.
 */
@Tag(name = "캡처", description = "iOS Shortcut 모바일 캡처 — ApiToken(Bearer wnt_) 인증")
@RestController
@RequestMapping("/api/capture")
class CaptureController(
    private val memoService: MemoService,
    private val idempotencyCache: IdempotencyCache,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping(produces = [MediaType.APPLICATION_JSON_VALUE])
    @Operation(
        summary = "모바일 캡처",
        description = "ApiToken(Bearer wnt_) 인증. Idempotency-Key 헤더로 5분 멱등성 보장 (동일 key 재전송 시 cached 응답 반환).",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "캡처 성공 (신규 또는 캐시 hit)"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — 필수 필드 누락 / 길이 초과"),
            ApiResponse(responseCode = "401", description = "API_TOKEN_MISSING / INVALID / REVOKED"),
        ],
    )
    fun captureMobile(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestHeader(value = "Idempotency-Key", required = false) idempotencyKey: String?,
        @Valid @RequestBody request: MobileCaptureRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        // 멱등성 캐시 — key 는 사용자별 격리(cross-user 충돌·정보 노출 방지, FR-024)
        val cacheKey = idempotencyKey?.let { "${principal.userId}:$it" }
        if (cacheKey != null) {
            val cached = idempotencyCache.get(cacheKey)
            if (cached != null) {
                @Suppress("UNCHECKED_CAST")
                val cachedResult = objectMapper.readValue(cached, Result::class.java) as Result<MemoResponse>
                return ResponseEntity.status(HttpStatus.CREATED).body(cachedResult)
            }
        }

        val response = memoService.captureMobile(userId = principal.userId, request = request)
        val result = Result.success(response)

        if (cacheKey != null) {
            idempotencyCache.put(cacheKey, objectMapper.writeValueAsString(result))
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(result)
    }
}
