package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.model.response.Result
import com.writenote.service.ProjectService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
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
    @Operation(summary = "프로젝트 생성", description = "JWT principal 의 userId 를 owner 로 새 프로젝트 생성")
    fun createProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateProjectRequest,
    ): ResponseEntity<Result<ProjectResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(projectService.createProject(principal.userId, request)))

    @GetMapping
    @Operation(summary = "프로젝트 목록", description = "본인 프로젝트 (archived = false) 페이지네이션 조회")
    fun listProjects(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Result<PageResponse<ProjectResponse>> = Result.success(projectService.listProjects(principal.userId, page, size))

    @GetMapping("/{projectId}")
    @Operation(summary = "프로젝트 단건 조회", description = "본인 프로젝트만. 다른 사용자 리소스 접근 시 404 NOT_FOUND")
    fun getProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.getProject(principal.userId, projectId))

    @PatchMapping("/{projectId}")
    @Operation(summary = "프로젝트 제목 수정", description = "본인 프로젝트만 (archived = false)")
    fun updateProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: UpdateProjectRequest,
    ): Result<ProjectResponse> = Result.success(projectService.updateProject(principal.userId, projectId, request))

    @PatchMapping("/{projectId}/archive")
    @Operation(summary = "프로젝트 보관", description = "본인 프로젝트 archived = true 박음 — 목록에서 제외")
    fun archiveProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.archiveProject(principal.userId, projectId))
}
