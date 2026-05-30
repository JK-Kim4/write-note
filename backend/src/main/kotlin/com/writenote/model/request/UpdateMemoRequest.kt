package com.writenote.model.request

/** M4 PATCH /api/memos/{id} — body/reasonNote/tags null = 미변경. */
data class UpdateMemoRequest(
    val body: String? = null,
    val reasonNote: String? = null,
    val tags: List<String>? = null,
)
