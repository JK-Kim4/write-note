package com.writenote.model.response

import java.time.Instant

/** 집필 기록 응답. desktop ProjectLog 대응. */
data class ProjectLogResponse(
    val id: Long,
    val projectId: Long,
    val body: String,
    val createdAt: Instant,
)
