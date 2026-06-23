package com.writenote.mapper

import com.writenote.entity.Category
import com.writenote.entity.Project
import com.writenote.model.response.ProjectResponse
import org.springframework.stereotype.Component

@Component
class ProjectMapper {
    /**
     * [project] → 응답. effective 판형/출판방식(033 R2) 은 소속 시리즈([category]) 기준 해석:
     * 작품이 시리즈에 속하고 그 시리즈가 값을 설정했으면 시리즈값, 아니면 시스템 기본값([DEFAULT_PAPER_SIZE]/[DEFAULT_LAYOUT_MODE]).
     * 미분류 작품은 [category] = null 로 전달한다(전부 기본값 fallback).
     */
    fun toResponse(
        project: Project,
        category: Category?,
    ): ProjectResponse =
        ProjectResponse(
            id = requireNotNull(project.id),
            title = project.title,
            genre = project.genre,
            targetLength = project.targetLength,
            toneNotes = project.toneNotes,
            synopsis = project.synopsis,
            worldNotes = project.worldNotes,
            nextScene = project.nextScene,
            paperSize = project.paperSize,
            layoutMode = project.layoutMode,
            fontScale = project.fontScale,
            archivedAt = project.archivedAt,
            createdAt = requireNotNull(project.createdAt),
            updatedAt = requireNotNull(project.updatedAt),
            categoryId = project.categoryId,
            effectivePaperSize = category?.paperSize ?: DEFAULT_PAPER_SIZE,
            effectiveLayoutMode = category?.layoutMode ?: DEFAULT_LAYOUT_MODE,
        )

    companion object {
        /** 시스템 기본 판형 — 현행 Project default 재사용(렌더 연속성, data-model.md). */
        const val DEFAULT_PAPER_SIZE = "A4"

        /** 시스템 기본 출판방식 — 현행 Project default 재사용. */
        const val DEFAULT_LAYOUT_MODE = "paper"
    }
}
