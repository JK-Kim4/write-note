package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.EndWithLogRequest
import com.writenote.model.response.EndWithLogResponse
import com.writenote.model.response.Result
import com.writenote.model.response.WorkSessionResponse
import com.writenote.service.WorkSessionService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 작업 세션 — 시작/자동종료/종료+기록/총 작업시간.
 *
 * desktop `sessions:start` / `sessions:end` / `sessions:endWithLog` 대응. owner 식별은 JWT principal.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/work-sessions")
@Tag(name = "작업 세션", description = "집필 작업 세션 추적")
@SecurityRequirement(name = "BearerJwt")
class WorkSessionController(
    private val workSessionService: WorkSessionService,
) {
    @PostMapping("/start")
    @Operation(summary = "작업 세션 시작", description = "작품의 기존 열린 세션 정리 후 새 세션 시작(작품당 1개).")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 작품 본인 소유 아님 / 미존재"),
        ],
    )
    fun start(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<WorkSessionResponse> = Result.success(workSessionService.start(principal.userId, projectId))

    @PostMapping("/end")
    @Operation(summary = "작업 세션 자동 종료", description = "30초 미만 폐기, 이상 보존. 열린 세션 없으면 data=null.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (폐기/없음 시 data=null)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun end(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<WorkSessionResponse?> = Result.success(workSessionService.end(principal.userId, projectId))

    @PostMapping("/end-with-log")
    @Operation(summary = "작업 종료 + 기록", description = "세션 종료(짧아도 보존) + 집필 기록 생성을 단일 트랜잭션.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — body 누락/길이 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun endWithLog(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: EndWithLogRequest,
    ): Result<EndWithLogResponse> = Result.success(workSessionService.endWithLog(principal.userId, projectId, request.body))

    @GetMapping("/total")
    @Operation(summary = "총 작업시간(ms)", description = "종료된 세션 합(진행 중·폐기 제외). 카드 집계용.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun total(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<TotalDurationResponse> =
        Result.success(TotalDurationResponse(workSessionService.totalDurationMs(principal.userId, projectId)))
}

/** 총 작업시간 응답 래퍼. */
data class TotalDurationResponse(
    val totalDurationMs: Long,
)
