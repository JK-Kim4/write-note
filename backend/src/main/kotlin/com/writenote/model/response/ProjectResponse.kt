package com.writenote.model.response

import java.time.Instant

data class ProjectResponse(
    val id: Long,
    val title: String,
    val genre: String?,
    val targetLength: Int?,
    val toneNotes: String?,
    val synopsis: String?,
    val worldNotes: String?,
    val nextScene: String,
    val paperSize: String,
    val layoutMode: String,
    val fontScale: String,
    val archivedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** 소속 모음 id. null = 미분류(032). */
    val categoryId: Long? = null,
)
