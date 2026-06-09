package com.writenote.model.response

import java.time.Instant

data class DocumentResponse(
    val id: Long,
    val projectId: Long,
    val title: String,
    val body: String,
    val wordCount: Int,
    // version 과 updatedAt 은 동일 값(겸용). version 은 불투명 토큰, ISO8601 문자열로 직렬화됨.
    val version: Instant,
    val updatedAt: Instant,
)
