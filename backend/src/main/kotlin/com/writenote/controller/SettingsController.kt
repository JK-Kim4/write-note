package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.UpdateSettingsRequest
import com.writenote.model.response.Result
import com.writenote.model.response.SettingsResponse
import com.writenote.service.SettingsService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 사용자 환경설정 엔드포인트 (019 US2 / #37, JWT 인증). 테마·작성 모드·원고지 크기 다기기 동기화.
 */
@Tag(name = "설정", description = "사용자 환경설정 조회·갱신 — owner 는 JWT principal 에서 도출")
@RestController
@RequestMapping("/api/settings")
@SecurityRequirement(name = "BearerJwt")
class SettingsController(
    private val settingsService: SettingsService,
) {
    @GetMapping
    @Operation(summary = "설정 조회", description = "저장된 환경설정 전체(key-value 맵). 미저장이면 빈 맵.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — SettingsResponse"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun getSettings(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
    ): ResponseEntity<Result<SettingsResponse>> = ResponseEntity.ok(Result.success(settingsService.getSettings(principal.userId)))

    @PutMapping
    @Operation(
        summary = "설정 갱신",
        description = "보낸 key 만 부분 upsert(per-key last-write-wins). 허용 외 key/value 는 400.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — 갱신 후 SettingsResponse"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — 허용 외 key/value"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun updateSettings(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestBody request: UpdateSettingsRequest,
    ): ResponseEntity<Result<SettingsResponse>> =
        ResponseEntity.ok(Result.success(settingsService.updateSettings(principal.userId, request.settings)))
}
