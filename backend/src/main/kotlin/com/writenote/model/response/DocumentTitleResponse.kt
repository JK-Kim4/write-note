package com.writenote.model.response

import java.time.Instant

data class DocumentTitleResponse(
    val id: Long,
    val title: String,
    val updatedAt: Instant,
)
