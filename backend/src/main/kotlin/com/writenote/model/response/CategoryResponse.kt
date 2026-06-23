package com.writenote.model.response

import java.time.Instant

/**
 * 모음(카테고리) 응답 — `/api/categories`.
 *
 * [projectCount] 는 해당 모음의 활성 작품 수(보관 제외) 서버 집계. 작품 0개 모음도 목록에 포함된다.
 * [parentId] 는 N뎁스 설계용으로 v1 에서는 항상 null.
 *
 * [paperSize]·[layoutMode] 는 시리즈 출판 메타(033 R2, null=미설정). 하위 작품 effective 해석의 원천.
 * [genre]·[synopsis] 는 시리즈 장르·줄거리(033 R3, null=미설정).
 *
 * [targetLength] 는 시리즈 총 목표 분량(033 R4, null=미설정). [totalWordCount] 는 해당 시리즈 소속의
 * 보관(archived) 아닌 작품들의 활성 본문(deleted_at IS NULL) word_count 합. 진척률·0 나눗셈 가드는 FE 책임.
 *
 * [totalDurationMs] 는 시리즈 소속(보관 아닌) 작품들의 종료된 work_session 집필 시간 합(ms, timewatch).
 */
data class CategoryResponse(
    val id: Long,
    val name: String,
    val parentId: Long?,
    val sortOrder: Int,
    val projectCount: Int,
    val paperSize: String?,
    val layoutMode: String?,
    val genre: String?,
    val synopsis: String?,
    val targetLength: Int?,
    val totalWordCount: Int,
    /** 소속 작품들의 종료된 세션 집필 시간 합(ms) */
    val totalDurationMs: Long,
    val createdAt: Instant,
    val updatedAt: Instant,
)
