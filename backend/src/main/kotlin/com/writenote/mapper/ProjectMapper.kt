package com.writenote.mapper

import com.writenote.entity.Project
import com.writenote.model.response.ProjectResponse
import org.springframework.stereotype.Component

@Component
class ProjectMapper {
    fun toResponse(project: Project): ProjectResponse =
        ProjectResponse(
            id = requireNotNull(project.id),
            title = project.title,
            genre = project.genre,
            targetLength = project.targetLength,
            toneNotes = project.toneNotes,
            synopsis = project.synopsis,
            worldNotes = project.worldNotes,
            nextScene = project.nextScene,
            archivedAt = project.archivedAt,
            createdAt = requireNotNull(project.createdAt),
            updatedAt = requireNotNull(project.updatedAt),
        )
}
