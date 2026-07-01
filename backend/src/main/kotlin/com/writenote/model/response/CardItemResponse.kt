package com.writenote.model.response

import java.time.Instant

/**
 * 카드 관리(048) 응답 — 여러 보드를 가로지르는 카드 목록/상세 항목.
 *
 * [boardId]/[boardName] = 소속 보드(null = 어느 보드에도 없는 독립 카드 → FE "속한 보드 없음").
 * [ownerType]/[ownerLabel] = 그 보드가 속한 대상 — "project"/"category"/null(아이디어 보드). ownerLabel=작품명/시리즈명/"아이디어".
 *   독립 카드(boardId=null)는 owner 정보도 null. FE 가 작품/시리즈 소속을 칩으로 보여줌.
 * [linkCount] = 연결된 다른 카드 수(distinct 이웃). [createdAt] = 정렬 키(생성일 내림차순) + 집필 뷰 그룹 내 정렬.
 */
data class CardItemResponse(
    val id: Long,
    val boardId: Long?,
    val boardName: String?,
    val ownerType: String?,
    val ownerLabel: String?,
    val body: String,
    val type: String?,
    val linkCount: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)
