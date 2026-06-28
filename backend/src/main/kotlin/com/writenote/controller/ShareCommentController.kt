package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.error.ShareErrorCode
import com.writenote.error.ShareException
import com.writenote.model.request.CreateCommentRequest
import com.writenote.model.response.AuthorCommentResponse
import com.writenote.model.response.CommentResponse
import com.writenote.model.response.DeleteCommentResponse
import com.writenote.model.response.Result
import com.writenote.service.ShareCommentService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * 공유 댓글(046 R2) — 회원 위치 지정 댓글(작가 전용 비공개).
 *
 * 작성 = permitAll 공개 경로 + nullable principal(optional auth): 비로그인이면 [ShareErrorCode.COMMENT_UNAUTHENTICATED] 401.
 * 삭제·작가 인박스 = authenticated(SecurityConfig anyRequest 및 projects 경로 보호).
 */
@RestController
@Tag(name = "공유 댓글", description = "위치 지정 댓글 — 작가 전용 비공개 피드백 (046 R2)")
class ShareCommentController(
    private val shareCommentService: ShareCommentService,
) {
    @PostMapping("/api/shared/{token}/works/{projectId}/comments")
    @Operation(summary = "댓글 작성", description = "회원 필수(비로그인 401). 앵커 범위 초과 400, 비활성 링크 404")
    fun createComment(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal?,
        @PathVariable token: String,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: CreateCommentRequest,
    ): Result<CommentResponse> {
        val userId = principal?.userId ?: throw ShareException(ShareErrorCode.COMMENT_UNAUTHENTICATED)
        return Result.success(shareCommentService.create(userId, token, projectId, request))
    }

    @DeleteMapping("/api/share-comments/{id}")
    @Operation(summary = "댓글 삭제", description = "본인 댓글만. 없는 댓글 404, 타인 댓글 403")
    fun deleteComment(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
    ): Result<DeleteCommentResponse> {
        shareCommentService.deleteOwn(principal.userId, id)
        return Result.success(DeleteCommentResponse(deleted = true))
    }

    @GetMapping("/api/projects/{projectId}/comments")
    @Operation(summary = "작가 댓글 인박스", description = "소유 작품의 전체 댓글(최근순). 타 작품 403")
    fun authorComments(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<List<AuthorCommentResponse>> = Result.success(shareCommentService.listForAuthor(principal.userId, projectId))
}
