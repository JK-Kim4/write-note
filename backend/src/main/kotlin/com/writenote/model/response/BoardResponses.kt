package com.writenote.model.response

import java.time.Instant

// 플롯 보드(038) 응답 DTO 모음. 매핑(projectId·categoryId)은 null=미매핑. viewport 는 마지막 화면 상태.

/** 보드의 마지막 화면 상태(줌 배율·이동 위치). */
data class ViewportDto(
    val zoom: Double,
    val x: Double,
    val y: Double,
)

/** 보드 단건 응답. */
data class BoardResponse(
    val id: Long,
    val name: String,
    val projectId: Long?,
    val categoryId: Long?,
    val viewport: ViewportDto,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** 보드 목록 항목 — 노드 수 동봉. */
data class BoardSummary(
    val id: Long,
    val name: String,
    val projectId: Long?,
    val categoryId: Long?,
    val nodeCount: Int,
    val updatedAt: Instant,
)

/** 보드 하이드레이션 — 메타 + 노드 + 엣지를 한 번에. */
data class BoardDetailResponse(
    val board: BoardResponse,
    val nodes: List<NodeResponse>,
    val edges: List<EdgeResponse>,
)

/** 플롯 노드 응답. [type] = 역할 타입(plot/character/place/theme/note, V25). */
data class NodeResponse(
    val id: Long,
    val body: String,
    val type: String,
    val posX: Double,
    val posY: Double,
    val zIndex: Int,
    val updatedAt: Instant,
)

/** 연결(엣지) 응답. */
data class EdgeResponse(
    val id: Long,
    val sourceNodeId: Long,
    val targetNodeId: Long,
)
