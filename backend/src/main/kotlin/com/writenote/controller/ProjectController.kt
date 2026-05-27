package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.model.response.Result
import com.writenote.service.ProjectService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/projects")
@Tag(name = "프로젝트", description = "작가 본인의 프로젝트 CRUD — owner 식별은 JWT principal 에서만 도출")
@SecurityRequirement(name = "BearerJwt")
class ProjectController(
    private val projectService: ProjectService,
) {
    @PostMapping
    @Operation(summary = "프로젝트 생성", description = "JWT principal 의 userId 를 owner 로 새 프로젝트 + 빈 본문 1:1 자동 행 생성 (FR-009/010)")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "201", description = "생성 성공 (Document 자동 행 박힘)"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — title 누락 / 길이 초과 / 메타 필드 범위 초과"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_MISSING / INVALID / EXPIRED"),
            ApiResponse(responseCode = "500", description = "INTERNAL_ERROR — Document 자동 행 박기 실패 시 트랜잭션 롤백"),
        ],
    )
    fun createProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateProjectRequest,
    ): ResponseEntity<Result<ProjectResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(projectService.createProject(principal.userId, request)))

    @GetMapping
    @Operation(summary = "프로젝트 목록", description = "?archived=false (활성, default) / true (보관함) 분리 조회")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (페이지네이션 envelope)"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — size > 100"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun listProjects(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(defaultValue = "false") archived: Boolean,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Result<PageResponse<ProjectResponse>> = Result.success(projectService.listProjects(principal.userId, page, size, archived))

    @GetMapping("/{projectId}")
    @Operation(summary = "프로젝트 단건 조회", description = "본인 프로젝트만 (보관 상태 무관). 다른 사용자 리소스 접근 시 404 NOT_FOUND")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND — 본인 소유 아님 / 미존재"),
        ],
    )
    fun getProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.getProject(principal.userId, projectId))

    @PatchMapping("/{projectId}")
    @Operation(summary = "프로젝트 메타 부분 수정", description = "본인 프로젝트만. null 필드는 미변경, 명시값은 갱신")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공"),
            ApiResponse(responseCode = "400", description = "VALIDATION_FAILED — 명시된 필드의 검증 실패"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun updateProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: UpdateProjectRequest,
    ): Result<ProjectResponse> = Result.success(projectService.updateProject(principal.userId, projectId, request))

    @PostMapping("/{projectId}/archive")
    @Operation(summary = "프로젝트 보관", description = "본인 프로젝트 archivedAt = now 박음. 멱등 — 이미 보관 상태면 시각 유지")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (archivedAt 박힘)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun archiveProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.archiveProject(principal.userId, projectId))

    @PostMapping("/{projectId}/unarchive")
    @Operation(summary = "프로젝트 보관 해제", description = "본인 프로젝트 archivedAt = null 박음. 멱등 — 미보관 상태에서 호출 시 no-op")
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 (archivedAt = null)"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun unarchiveProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.unarchiveProject(principal.userId, projectId))

    @DeleteMapping("/{projectId}")
    @Operation(
        summary = "프로젝트 영구 삭제",
        description = "본인 프로젝트 영구 삭제 — DB FK CASCADE 로 자식 (characters / documents) 자동 정리",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "204", description = "성공 — body 없음"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
            ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND"),
        ],
    )
    fun deleteProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): ResponseEntity<Void> {
        projectService.deleteProject(principal.userId, projectId)
        return ResponseEntity.noContent().build()
    }
}
