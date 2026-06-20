package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateProjectLogRequest
import com.writenote.model.response.ProjectLogResponse
import com.writenote.model.response.Result
import com.writenote.service.ProjectLogService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 집필 기록 — 독립 생성(POST) + 조회(GET 목록 / 최신 1).
 *
 * desktop `logs:listByProject` + 독립 생성(spec Q1) 대응. owner 식별은 JWT principal.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/logs")
@Tag(name = "집필 기록", description = "작품별 집필 기록 생성·조회")
@SecurityRequirement(name = "BearerJwt")
class ProjectLogController(
    private val projectLogService: ProjectLogService,
) {
    @PostMapping
    @Operation(summary = "집필 기록 생성", description = "세션과 무관한 독립 생성. 본인 작품만.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "생성 성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — body 누락/길이 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 작품 본인 소유 아님 / 미존재"),
        ],
    )
    fun createLog(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: CreateProjectLogRequest,
    ): ResponseEntity<Result<ProjectLogResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(projectLogService.create(principal.userId, projectId, request.body)))

    @GetMapping
    @Operation(summary = "집필 기록 목록", description = "생성 최신순. 본인 작품만.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun listLogs(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<List<ProjectLogResponse>> = Result.success(projectLogService.listByProject(principal.userId, projectId))

    @GetMapping("/latest")
    @Operation(summary = "최신 집필 기록 1건", description = "카드 집계용. 없으면 data=null. 본인 작품만.")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (없으면 data=null)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun latestLog(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectLogResponse?> = Result.success(projectLogService.latestByProject(principal.userId, projectId))
}
