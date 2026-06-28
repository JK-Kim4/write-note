package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateShareLinkRequest
import com.writenote.model.request.SetPublicWorksRequest
import com.writenote.model.request.UpdateShareLinkRequest
import com.writenote.model.response.Result
import com.writenote.model.response.ShareLinkResponse
import com.writenote.model.response.SharedViewResponse
import com.writenote.model.response.SharedWorkResponse
import com.writenote.service.ShareCommentService
import com.writenote.service.ShareService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/**
 * 공유하기(046) — 작가 링크 관리(인증) + 비로그인 공개 열람(permitAll + optional auth).
 *
 * 공개 GET(`/api/shared` 이하)은 nullable [AuthenticatedPrincipal] — 토큰 없으면 익명, 회원이면 식별(R2 댓글용).
 */
@RestController
@Tag(name = "공유하기", description = "공유 링크 + 불변 스냅샷 + 비로그인 공개 읽기 (046)")
class ShareController(
    private val shareService: ShareService,
    private val shareCommentService: ShareCommentService,
) {
    // ── 작가 — 링크 관리 (authenticated) ─────────────────────────────────────────

    @PostMapping("/api/share-links")
    @Operation(summary = "공유 링크 생성", description = "work=즉시 스냅샷 동결. 타인 작품 403, 없는 작품 404")
    fun createShareLink(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateShareLinkRequest,
    ): Result<ShareLinkResponse> = Result.success(shareService.createShareLink(principal.userId, request))

    @PatchMapping("/api/share-links/{id}")
    @Operation(summary = "공유 링크 끄기", description = "isActive=false 로 revoke(비활성). 본인 링크만")
    fun revokeShareLink(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: UpdateShareLinkRequest,
    ): Result<ShareLinkResponse> = Result.success(shareService.revoke(principal.userId, id, request.isActive))

    @PutMapping("/api/share-links/{id}/works")
    @Operation(
        summary = "시리즈 공개 작품 선택",
        description = "series 링크 전용. 추가분 스냅샷 동결·제거분 삭제. 시리즈 비소속 작품은 400",
    )
    fun setPublicWorks(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable id: Long,
        @RequestBody request: SetPublicWorksRequest,
    ): Result<ShareLinkResponse> = Result.success(shareService.setPublicWorks(principal.userId, id, request.projectIds))

    @GetMapping("/api/share-links/mine")
    @Operation(summary = "내 공유 링크 목록", description = "최근순, 스냅샷 메타 동봉")
    fun listMyShareLinks(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): Result<List<ShareLinkResponse>> = Result.success(shareService.listMine(principal.userId))

    // ── 공개 — 열람 (permitAll, nullable principal) ──────────────────────────────

    @GetMapping("/api/shared/{token}")
    @Operation(summary = "공개 열람 진입", description = "비로그인 허용. 비활성/미존재 동형 404")
    fun getPublicView(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal?,
        @PathVariable token: String,
    ): Result<SharedViewResponse> = Result.success(shareService.getPublicView(token))

    @GetMapping("/api/shared/{token}/works/{projectId}")
    @Operation(summary = "공개 본문 열람", description = "스냅샷 owner 키 복호 평문 PM JSON + 요청자 본인 댓글만(가시성 R-3). 비로그인 허용")
    fun getSharedWork(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal?,
        @PathVariable token: String,
        @PathVariable projectId: Long,
    ): Result<SharedWorkResponse> {
        val work = shareService.getSharedWork(token, projectId)
        // 댓글 가시성(R-3): 회원이면 본인 댓글만, 비로그인이면 빈 배열.
        val comments = shareCommentService.listMineForSharedWork(token, projectId, principal?.userId)
        return Result.success(work.copy(comments = comments))
    }
}
