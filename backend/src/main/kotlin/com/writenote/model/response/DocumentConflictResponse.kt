package com.writenote.model.response

import java.time.Instant

data class DocumentConflictResponse(
    val code: String,
    val message: String,
    // currentVersion = 현재 DB updatedAt. ISO8601 문자열로 직렬화됨.
    val currentVersion: Instant,
    val currentBody: String,
)
