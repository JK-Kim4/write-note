package com.writenote.model.response

import java.time.Instant

data class DocumentSaveResponse(
    val id: Long,
    val body: String,
    val wordCount: Int,
    // version = flush 후 확정된 새 updatedAt. ISO8601 문자열로 직렬화됨.
    val version: Instant,
    val updatedAt: Instant,
)
