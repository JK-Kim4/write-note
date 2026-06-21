package com.writenote.model.response

import java.time.Instant

/** 공개 공지 목록 항목 — 본문 제외(요약). */
data class AnnouncementSummaryResponse(
    val id: Long,
    val title: String,
    val publishedAt: Instant?,
)

/** 공개 공지 상세 — 본문 포함. */
data class AnnouncementDetailResponse(
    val id: Long,
    val title: String,
    val body: String,
    val publishedAt: Instant?,
)

/** 어드민 공지 — 공개/고정 상태 등 전체 필드. */
data class AdminAnnouncementResponse(
    val id: Long,
    val title: String,
    val body: String,
    val isPublished: Boolean,
    val isPinned: Boolean,
    val publishedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
