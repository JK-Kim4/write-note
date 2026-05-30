package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CaptureMemoRequest
import com.writenote.model.response.MemoResponse
import com.writenote.model.response.Result
import com.writenote.service.MemoService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 메모 엔드포인트 (JWT 인증).
 *
 * M3 데스크탑 캡처 외 M1/M2/M4/M5/M7 은 US4/US5 에서 추가.
 */
@RestController
@RequestMapping("/api/memos")
class MemoController(
    private val memoService: MemoService,
) {
    /** M3 — 데스크탑 캡처 (⌘+N). source=DESKTOP, JWT 인증. */
    @PostMapping
    fun captureDesktop(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CaptureMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoService.captureDesktop(userId = principal.userId, request = request)
        return ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response))
    }
}
