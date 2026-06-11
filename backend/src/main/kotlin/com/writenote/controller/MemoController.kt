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
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
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
@Tag(name = "메모", description = "메모 목록·단건 조회, 수정, 삭제, 큐레이션 — owner 식별은 JWT principal 에서만 도출")
@RestController
@RequestMapping("/api/memos")
@SecurityRequirement(name = "BearerJwt")
class MemoController(
    private val memoService: MemoService,
    private val memoQueryService: MemoQueryService,
    private val memoEditService: MemoEditService,
    private val memoCurationService: MemoCurationService,
) {
    /** M1 — 메모 목록 (필터 + 페이지네이션, N+1 회피). */
    @GetMapping
    @Operation(
        summary = "메모 목록",
        description = "필터(unclassified / projectId / characterId / tag / q) + 페이지네이션. size 범위 1~100.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — Page<MemoResponse>"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — size 범위 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
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
    @Operation(summary = "메모 단건 조회", description = "본인 소유 메모만. 타인·미존재 시 404.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 아님 / 미존재"),
        ],
    )
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
    @Operation(summary = "메모 부분 수정", description = "body / reasonNote / tags 중 전달된 필드만 갱신. null = 미변경.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 아님 / 미존재"),
        ],
    )
    fun updateMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: UpdateMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoEditService.updateMemo(userId = principal.userId, memoId = id, request = request)
        return ResponseEntity.ok(Result.success(response))
    }

    /** M5 — 버리기 (soft-delete). 연결행 보존 → 복원 가능. 이미 버려진 메모면 멱등(204). */
    @DeleteMapping("/{id}")
    @Operation(
        summary = "메모 버리기",
        description = "본인 메모 버리기(soft-delete) — 연결 보존, POST /{id}/restore 로 복원 가능. 이미 버려졌으면 멱등.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "204", description = "버리기 성공 — body 없음"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 아님 / 미존재"),
        ],
    )
    fun deleteMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): ResponseEntity<Void> {
        memoEditService.deleteMemo(userId = principal.userId, memoId = id)
        return ResponseEntity.noContent().build()
    }

    /** 버린 메모 되돌리기 — deletedAt 을 NULL 로. 연결·고정 복귀. 버려지지 않았으면 멱등(200). */
    @PostMapping("/{id}/restore")
    @Operation(
        summary = "메모 되돌리기",
        description = "버린 본인 메모를 되돌린다(soft-delete 해제) — 작품 연결·고정 복귀. 버려지지 않았으면 멱등.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "복원 성공 — MemoResponse"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 아님 / 미존재"),
        ],
    )
    fun restoreMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoEditService.restoreMemo(userId = principal.userId, memoId = id)
        return ResponseEntity.ok(Result.success(response))
    }

    /** M7 — 큐레이션 (선언적 전체 상태, 차이 계산 + 단일 트랜잭션). */
    @PutMapping("/{id}/curation")
    @Operation(
        summary = "메모 큐레이션",
        description = "projectIds / characterIds 를 선언적 전체 상태로 전달 → 차이 계산 후 단일 트랜잭션 반영.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 메모 / 프로젝트 / 등장인물 본인 소유 아님 또는 미존재"),
        ],
    )
    fun curateMemo(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: CurateMemoRequest,
    ): ResponseEntity<Result<MemoResponse>> {
        val response = memoCurationService.curate(userId = principal.userId, memoId = id, request = request)
        return ResponseEntity.ok(Result.success(response))
    }
}
