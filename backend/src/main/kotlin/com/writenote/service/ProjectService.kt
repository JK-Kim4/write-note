package com.writenote.service

import com.writenote.entity.Project
import com.writenote.error.ResourceNotFoundException
import com.writenote.mapper.ProjectMapper
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.UpdateProjectRequest
import com.writenote.model.response.PageResponse
import com.writenote.model.response.ProjectResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ProjectService(
    private val projectRepository: ProjectRepository,
    private val userRepository: UserRepository,
    private val projectMapper: ProjectMapper,
) {
    @Transactional
    fun createProject(
        userId: Long,
        request: CreateProjectRequest,
    ): ProjectResponse {
        requireExistingUser(userId)
        val project = projectRepository.save(Project(userId = userId, title = request.title.trim()))
        return projectMapper.toResponse(project)
    }

    @Transactional(readOnly = true)
    fun listProjects(
        userId: Long,
        page: Int,
        size: Int,
    ): PageResponse<ProjectResponse> {
        requireExistingUser(userId)
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }

        val projects =
            projectRepository
                .findByUserIdAndArchivedFalseOrderByUpdatedAtDesc(userId, PageRequest.of(page, size))
                .map(projectMapper::toResponse)

        return PageResponse.from(projects)
    }

    @Transactional(readOnly = true)
    fun getProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse =
        projectRepository
            .findByIdAndUserIdAndArchivedFalse(projectId, userId)
            .map(projectMapper::toResponse)
            .orElseThrow { ResourceNotFoundException("Project not found") }

    @Transactional
    fun updateProject(
        userId: Long,
        projectId: Long,
        request: UpdateProjectRequest,
    ): ProjectResponse {
        val project =
            projectRepository
                .findByIdAndUserIdAndArchivedFalse(projectId, userId)
                .orElseThrow { ResourceNotFoundException("Project not found") }

        project.title = request.title.trim()

        return projectMapper.toResponse(project)
    }

    @Transactional
    fun archiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project =
            projectRepository
                .findByIdAndUserId(projectId, userId)
                .orElseThrow { ResourceNotFoundException("Project not found") }

        project.archived = true

        return projectMapper.toResponse(project)
    }

    private fun requireExistingUser(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw ResourceNotFoundException("User not found")
        }
    }
}
