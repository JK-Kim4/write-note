package com.writenote.model.response

import java.time.Instant

/**
 * 메모 단건 응답.
 *
 * 캡처 직후에는 `projects` 빈 배열 (미분류 상태). 큐레이션 이후 채워짐.
 */
data class MemoResponse(
    val id: Long,
    val body: String,
    /** 'MOBILE' 또는 'DESKTOP' */
    val source: String,
    val capturedAt: Instant,
    /** 캡처 당시 활성 프로젝트 ID (nullable) */
    val activeProjectAtCapture: Long?,
    val reasonNote: String?,
    val tags: List<String>,
    /** 큐레이션된 프로젝트 목록 — 캡처 직후 빈 배열 */
    val projects: List<MemoProjectResponse> = emptyList(),
)
