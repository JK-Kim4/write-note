package com.writenote.controller.admin

import com.writenote.model.response.AdminStatsSummaryResponse
import com.writenote.model.response.Result
import com.writenote.model.response.SignupTrendResponse
import com.writenote.service.AdminStatsService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Tag(name = "AdminStats", description = "어드민 사용 현황 통계 — 단일 관리자만, KST 기준 집계")
@RestController
@RequestMapping("/api/admin/stats")
@SecurityRequirement(name = "BearerJwt")
class AdminStatsController(
    private val adminStatsService: AdminStatsService,
) {
    @GetMapping("/summary")
    @Operation(summary = "카운트 요약", description = "총 가입자/오늘·이번주 신규/활성(7일)/총 작품")
    fun summary(): Result<AdminStatsSummaryResponse> = Result.success(adminStatsService.summary())

    @GetMapping("/signups")
    @Operation(summary = "가입 추이", description = "최근 days 일 일별 가입 수(빈 날 0)")
    fun signups(
        @RequestParam(defaultValue = "30") days: Int,
    ): Result<SignupTrendResponse> = Result.success(adminStatsService.signups(days))
}
