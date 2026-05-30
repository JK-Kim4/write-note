package com.writenote.model.response

import java.time.Instant

data class DocumentResponse(
    val id: Long,
    val projectId: Long,
    val title: String,
    val body: String,
    val wordCount: Int,
    val version: Int,
    val updatedAt: Instant,
)
