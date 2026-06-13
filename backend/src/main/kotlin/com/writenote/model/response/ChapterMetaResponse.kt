package com.writenote.model.response

import java.time.Instant

/** C1 챕터 목록 응답 DTO — 본문(body) 제외 메타만 포함(전송량 절약). */
data class ChapterMetaResponse(
    val id: Long,
    val title: String,
    val sortOrder: Int,
    val wordCount: Int,
    val updatedAt: Instant,
)
