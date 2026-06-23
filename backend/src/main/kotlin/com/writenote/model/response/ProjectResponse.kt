package com.writenote.model.response

import java.time.Instant

data class ProjectResponse(
    val id: Long,
    val title: String,
    val genre: String?,
    val targetLength: Int?,
    val toneNotes: String?,
    val synopsis: String?,
    val worldNotes: String?,
    val nextScene: String,
    val paperSize: String,
    val layoutMode: String,
    val fontScale: String,
    val archivedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** 소속 모음 id. null = 미분류(032). */
    val categoryId: Long? = null,
    /** 적용 판형(033 R2) — 시리즈 판형 설정 시 시리즈값, 아니면 시스템 기본값 "A4". */
    val effectivePaperSize: String = "A4",
    /** 적용 출판방식(033 R2) — 시리즈 출판방식 설정 시 시리즈값, 아니면 시스템 기본값 "paper". */
    val effectiveLayoutMode: String = "paper",
)
