package com.writenote.model.response

import java.time.Instant

data class ProjectResponse(
    val id: Long,
    val title: String,
    val archived: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)
