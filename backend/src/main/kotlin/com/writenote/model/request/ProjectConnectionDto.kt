package com.writenote.model.request

/** M7 큐레이션 요청 내 프로젝트-인물 연결 단위. */
data class ProjectConnectionDto(
    val projectId: Long,
    val characterIds: List<Long> = emptyList(),
)
