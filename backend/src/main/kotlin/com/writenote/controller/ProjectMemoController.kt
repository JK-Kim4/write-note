package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.SetPinRequest
import com.writenote.model.response.ProjectMemoResponse
import com.writenote.model.response.Result
import com.writenote.service.MemoPinService
import com.writenote.service.MemoQueryService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 작품 맥락 곁쪽지 — 목록(고정 포함) + 고정 토글.
 *
 * desktop `memos:listByProject` / `memos:setPin` 대응. owner 식별은 JWT principal.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/memos")
@Tag(name = "작품 곁쪽지", description = "작품 맥락의 곁쪽지 목록 + 고정 토글")
@SecurityRequirement(name = "BearerJwt")
class ProjectMemoController(
    private val memoQueryService: MemoQueryService,
    private val memoPinService: MemoPinService,
) {
    @GetMapping
    @Operation(summary = "작품 곁쪽지 목록", description = "그 작품에 연결된 곁쪽지 + 고정 여부. 고정 우선·최신순.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 작품 본인 소유 아님 / 미존재"),
        ],
    )
    fun listByProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<List<ProjectMemoResponse>> = Result.success(memoQueryService.listByProject(principal.userId, projectId))

    @PutMapping("/{memoId}/pin")
    @Operation(summary = "곁쪽지 고정 토글", description = "pinned=true 시 작품 내 기존 고정 자동 해제(작품당 1개 불변식).")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 작품/메모 본인 소유 아님 / 미연결"),
        ],
    )
    fun setPin(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @PathVariable memoId: Long,
        @RequestBody request: SetPinRequest,
    ): Result<ProjectMemoResponse> = Result.success(memoPinService.setPin(principal.userId, projectId, memoId, request.pinned))
}
