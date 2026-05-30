package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.components.IdempotencyCache
import com.writenote.model.request.MobileCaptureRequest
import com.writenote.model.response.MemoResponse
import com.writenote.model.response.Result
import com.writenote.service.MemoService
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
@RestController
@RequestMapping("/api/capture")
class CaptureController(
    private val memoService: MemoService,
    private val idempotencyCache: IdempotencyCache,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping(produces = [MediaType.APPLICATION_JSON_VALUE])
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
