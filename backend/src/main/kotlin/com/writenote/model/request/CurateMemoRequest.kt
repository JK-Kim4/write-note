package com.writenote.model.request

/**
 * M7 PUT /api/memos/{id}/curation — 선언적 전체 상태.
 *
 * 서버가 현재 연결과 차이 계산 → add/remove 단일 트랜잭션.
 * projectConnections:[] → 미분류.
 */
data class CurateMemoRequest(
    val projectConnections: List<ProjectConnectionDto> = emptyList(),
    val tags: List<String> = emptyList(),
    val reasonNote: String? = null,
)
