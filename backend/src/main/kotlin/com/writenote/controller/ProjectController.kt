package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.model.response.Result
import com.writenote.service.ProjectService
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
class ProjectController(
    private val projectService: ProjectService,
) {
    @PostMapping
    fun createProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateProjectRequest,
    ): ResponseEntity<Result<ProjectResponse>> =
        ResponseEntity
            .status(HttpStatus.CREATED)
            .body(Result.success(projectService.createProject(principal.userId, request)))

    @GetMapping
    fun listProjects(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Result<PageResponse<ProjectResponse>> = Result.success(projectService.listProjects(principal.userId, page, size))

    @GetMapping("/{projectId}")
    fun getProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.getProject(principal.userId, projectId))

    @PatchMapping("/{projectId}")
    fun updateProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: UpdateProjectRequest,
    ): Result<ProjectResponse> = Result.success(projectService.updateProject(principal.userId, projectId, request))

    @PatchMapping("/{projectId}/archive")
    fun archiveProject(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
    ): Result<ProjectResponse> = Result.success(projectService.archiveProject(principal.userId, projectId))
}
