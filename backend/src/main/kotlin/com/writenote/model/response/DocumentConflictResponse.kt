package com.writenote.model.response

data class DocumentConflictResponse(
    val code: String,
    val message: String,
    val currentVersion: Int,
    val currentBody: String,
)
