package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateReactionRequest
import com.writenote.model.response.ReactionAggregate
import com.writenote.model.response.Result
import com.writenote.service.ShareReactionService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 공유 반응(050 R2 US3) — 공개 스냅샷 구간 이모지 토글(회원 전용 작성, 공개 집계).
 *
 * optional auth(permitAll + nullable [AuthenticatedPrincipal]) — 비회원은 컨트롤러가 [ShareErrorCode.COMMENT_UNAUTHENTICATED] 401.
 * 제거는 쿼리 파라미터(body 없음, research D3 — DELETE 바디 프록시 스멜 회피).
 */
@RestController
@Tag(name = "공유 반응", description = "공유 스냅샷 구간 이모지 반응 — 공개 집계 (050)")
class ShareReactionController(
    private val shareReactionService: ShareReactionService,
) {
    @PostMapping("/api/shared/{token}/works/{projectId}/reactions")
    @Operation(summary = "반응 추가", description = "회원 필수(비로그인 401). unique 멱등, 이모지 화이트리스트 밖 400")
    fun addReaction(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal?,
        @PathVariable token: String,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: CreateReactionRequest,
    ): Result<ReactionAggregate> {
        val userId = principal?.userId ?: throw ShareException(ShareErrorCode.COMMENT_UNAUTHENTICATED)
        return Result.success(shareReactionService.add(token, projectId, request, userId))
    }

    @DeleteMapping("/api/shared/{token}/works/{projectId}/reactions")
    @Operation(summary = "반응 제거(토글 off)", description = "회원 필수(비로그인 401). 본인 반응만, 쿼리 파라미터(body 없음)")
    fun removeReaction(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal?,
        @PathVariable token: String,
        @PathVariable projectId: Long,
        @RequestParam blockIndex: Int,
        @RequestParam start: Int,
        @RequestParam length: Int,
        @RequestParam emoji: String,
    ): Result<ReactionAggregate> {
        val userId = principal?.userId ?: throw ShareException(ShareErrorCode.COMMENT_UNAUTHENTICATED)
        return Result.success(shareReactionService.remove(token, projectId, blockIndex, start, length, emoji, userId))
    }
}
