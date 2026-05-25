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
import java.time.Instant

@Service
class ProjectService(
    private val projectRepository: ProjectRepository,
    private val userRepository: UserRepository,
    private val projectMapper: ProjectMapper,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun createProject(
        userId: Long,
        request: CreateProjectRequest,
    ): ProjectResponse {
        requireExistingUser(userId)
        val project =
            projectRepository.save(
                Project(
                    userId = userId,
                    title = request.title.trim(),
                    genre = request.genre,
                    targetLength = request.targetLength,
                    toneNotes = request.toneNotes,
                    synopsis = request.synopsis,
                    worldNotes = request.worldNotes,
                ),
            )
        return projectMapper.toResponse(project)
    }

    @Transactional(readOnly = true)
    fun listProjects(
        userId: Long,
        page: Int,
        size: Int,
        archived: Boolean,
    ): PageResponse<ProjectResponse> {
        requireExistingUser(userId)
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }

        val pageable = PageRequest.of(page, size)
        val projects =
            if (archived) {
                projectRepository.findByUserIdAndArchivedAtIsNotNullOrderByArchivedAtDesc(userId, pageable)
            } else {
                projectRepository.findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(userId, pageable)
            }

        return PageResponse.from(projects.map(projectMapper::toResponse))
    }

    @Transactional(readOnly = true)
    fun getProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse =
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .map(projectMapper::toResponse)
            .orElseThrow { ResourceNotFoundException("Project not found") }

    @Transactional(rollbackFor = [Exception::class])
    fun updateProject(
        userId: Long,
        projectId: Long,
        request: UpdateProjectRequest,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)

        request.title?.let { project.title = it.trim() }
        request.genre?.let { project.genre = it }
        request.targetLength?.let { project.targetLength = it }
        request.toneNotes?.let { project.toneNotes = it }
        request.synopsis?.let { project.synopsis = it }
        request.worldNotes?.let { project.worldNotes = it }

        return projectMapper.toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun archiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.archive(Instant.now())
        return projectMapper.toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun unarchiveProject(
        userId: Long,
        projectId: Long,
    ): ProjectResponse {
        val project = requireOwnedProject(userId, projectId)
        project.unarchive()
        return projectMapper.toResponse(project)
    }

    @Transactional(rollbackFor = [Exception::class])
    fun deleteProject(
        userId: Long,
        projectId: Long,
    ) {
        val project = requireOwnedProject(userId, projectId)
        projectRepository.delete(project)
    }

    fun requireOwnedProject(
        userId: Long,
        projectId: Long,
    ): Project =
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ResourceNotFoundException("Project not found") }

    private fun requireExistingUser(userId: Long) {
        if (!userRepository.existsById(userId)) {
            throw ResourceNotFoundException("User not found")
        }
    }
}
