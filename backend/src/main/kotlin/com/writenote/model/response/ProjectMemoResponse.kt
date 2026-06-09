package com.writenote.model.response

import java.time.Instant

/**
 * 작품 맥락의 곁쪽지 — 그 작품에서의 고정 여부 포함.
 *
 * desktop `ProjectMemo`(Memo & { pinned }) 대응 (listByProject / setPin 반환용).
 */
data class ProjectMemoResponse(
    val memoId: Long,
    val projectId: Long,
    val body: String,
    val source: String,
    val capturedAt: Instant,
    val reasonNote: String?,
    val tags: List<String>,
    val pinned: Boolean,
)
