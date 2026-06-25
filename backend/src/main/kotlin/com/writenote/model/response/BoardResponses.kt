package com.writenote.model.response

import java.time.Instant

// 플롯 보드(038, 041 트랙 C) 응답 DTO 모음. 소속(ownerType/ownerId)은 다형 단일 — null 짝=아이디어. viewport 는 마지막 화면 상태.

/** 보드의 마지막 화면 상태(줌 배율·이동 위치). */
data class ViewportDto(
    val zoom: Double,
    val x: Double,
    val y: Double,
)

/** 보드 단건 응답. [ownerType]="project"|"category"|null(아이디어), [ownerId]=대상 id(짝). */
data class BoardResponse(
    val id: Long,
    val name: String,
    val ownerType: String?,
    val ownerId: Long?,
    val viewport: ViewportDto,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** 보드 목록 항목(전역 허브) — 소속 라벨([ownerLabel]=작품명/시리즈명/"아이디어") + 카드 수 동봉. */
data class BoardSummary(
    val id: Long,
    val name: String,
    val ownerType: String?,
    val ownerId: Long?,
    val ownerLabel: String,
    val cardCount: Int,
    val updatedAt: Instant,
)

/** 보드 하이드레이션 — 메타 + 카드 + 연결을 한 번에. */
data class BoardDetailResponse(
    val board: BoardResponse,
    val cards: List<CardResponse>,
    val links: List<LinkResponse>,
)

/** 카드 응답. [type] = 역할 타입(plot/character/place/theme/note, V25). */
data class CardResponse(
    val id: Long,
    val body: String,
    val type: String,
    val posX: Double,
    val posY: Double,
    val zIndex: Int,
    val updatedAt: Instant,
)

/** 연결(링크) 응답. [sourceHandle]/[targetHandle]=연결 테두리 앵커(top/right/bottom/left 또는 null). */
data class LinkResponse(
    val id: Long,
    val sourceCardId: Long,
    val targetCardId: Long,
    val sourceHandle: String?,
    val targetHandle: String?,
)
