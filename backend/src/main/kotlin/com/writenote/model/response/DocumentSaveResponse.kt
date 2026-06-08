package com.writenote.model.response

import java.time.Instant

data class DocumentSaveResponse(
    val id: Long,
    val body: String,
    val wordCount: Int,
    val version: Int,
    val updatedAt: Instant,
)
