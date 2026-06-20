package com.writenote.model.response

import java.time.Instant

/** 작업 세션 응답. endedAt = null 이면 진행 중. */
data class WorkSessionResponse(
    val id: Long,
    val projectId: Long,
    val startedAt: Instant,
    val endedAt: Instant?,
)

/** 종료+기록 결과 — 보존된 세션(없으면 null) + 생성된 집필 기록. */
data class EndWithLogResponse(
    val session: WorkSessionResponse?,
    val log: ProjectLogResponse,
)
