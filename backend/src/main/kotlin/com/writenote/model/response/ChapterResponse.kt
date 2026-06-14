package com.writenote.model.response

import java.time.Instant

/** C2 챕터 생성 응답 DTO — 본문(body) 포함(생성 직후 집필실 진입용). */
data class ChapterResponse(
    val id: Long,
    val title: String,
    val sortOrder: Int,
    val body: String,
    val wordCount: Int,
    val updatedAt: Instant,
)
