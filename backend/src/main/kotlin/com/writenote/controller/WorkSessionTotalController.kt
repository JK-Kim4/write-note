package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.response.Result
import com.writenote.service.WorkSessionService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

/**
 * 작품 횡단 작업 세션 집계(018) — 기존 [WorkSessionController] 는 작품 경로
 * (`/api/projects/{projectId}/work-sessions`) 고정이라 사용자 전체 합계는 본 컨트롤러가 담당.
 */
@RestController
@RequestMapping("/api/work-sessions")
@Tag(name = "작업 세션(횡단)", description = "사용자 전체 작품의 작업시간 집계")
@SecurityRequirement(name = "BearerJwt")
class WorkSessionTotalController(
    private val workSessionService: WorkSessionService,
) {
    @GetMapping("/total")
    @Operation(
        summary = "기간 작업시간 합계(ms)",
        description = "전체 작품 횡단(아카이브 포함), from ≤ startedAt < to 인 종료 세션 합. 시간대 환산은 클라이언트 책임",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — from >= to / 파라미터 누락·형식 오류"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun rangeTotal(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam from: Instant,
        @RequestParam to: Instant,
    ): Result<TotalDurationResponse> =
        Result.success(TotalDurationResponse(workSessionService.rangeTotalDurationMs(principal.userId, from, to)))
}
