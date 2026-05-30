package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CaptureMemoRequest
import com.writenote.model.request.CurateMemoRequest
import com.writenote.model.request.UpdateMemoRequest
import com.writenote.model.response.MemoResponse
import com.writenote.model.response.Result
import com.writenote.service.MemoCurationService
import com.writenote.service.MemoEditService
import com.writenote.service.MemoQueryService
import com.writenote.service.MemoService
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 메모 엔드포인트 (JWT 인증).
 *
 * M3 데스크탑 캡처 (US3) + M1/M2/M4/M5/M7 (US4).
 */
@RestController
@RequestMapping("/api/memos")
class MemoController(
    private val memoService: MemoService,
    private val memoQueryService: MemoQueryService,
    private val memoEditService: MemoEditService,
    private val memoCurationService: MemoCurationService,
) {
    /** M1 — 메모 목록 (필터 + 페이지네이션, N+1 회피). */
    @GetMapping
    fun listMemos(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(defaultValue = "false") unclassified: Boolean,
        @RequestParam projectId: Long?,
        @RequestParam characterId: Long?,
        @RequestParam tag: String?,
        @RequestParam q: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ResponseEntity<Result<Page<MemoResponse>>> {
        require(size in 1..100) { "size must be between 1 and 100" }
        val pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "capturedAt"))
        val result =
            memoQueryService.listMemos(
                userId = principal.userId,
                unclassified = unclassified,
                projectId = projectId,
                characterId = characterId,
                tag = tag,
                q = q,
                pageable = pageable,
            )
        return ResponseEntity.ok(Result.success(result))
    }

    /** M2 — 단건 조회. */
    @GetMapping("/{id}")
    fun getMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoQueryService.getMemo(userId = principal.userId, memoId = id)
        return ResponseEntity.ok(Result.success(response))
    }

    /** M3 — 데스크탑 캡처 (⌘+N). source=DESKTOP, JWT 인증. */
    @PostMapping
    fun captureDesktop(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CaptureMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoService.captureDesktop(userId = principal.userId, request = request)
        return ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response))
    }

    /** M4 — 본문/reasonNote/tags 부분 수정. null = 미변경. */
    @PatchMapping("/{id}")
    fun updateMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: UpdateMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoEditService.updateMemo(userId = principal.userId, memoId = id, request = request)
        return ResponseEntity.ok(Result.success(response))
    }

    /** M5 — 삭제 (cascade: MemoProject/MemoProjectCharacter 정리). */
    @DeleteMapping("/{id}")
    fun deleteMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        memoEditService.deleteMemo(userId = principal.userId, memoId = id)
        return ResponseEntity.noContent().build()
    }

    /** M7 — 큐레이션 (선언적 전체 상태, 차이 계산 + 단일 트랜잭션). */
    @PutMapping("/{id}/curation")
    fun curateMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: CurateMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoCurationService.curate(userId = principal.userId, memoId = id, request = request)
        return ResponseEntity.ok(Result.success(response))
    }
}
