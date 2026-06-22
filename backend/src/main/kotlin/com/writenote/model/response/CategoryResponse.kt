package com.writenote.model.response

import java.time.Instant

/**
 * 모음(카테고리) 응답 — `/api/categories`.
 *
 * [projectCount] 는 해당 모음의 활성 작품 수(보관 제외) 서버 집계. 작품 0개 모음도 목록에 포함된다.
 * [parentId] 는 N뎁스 설계용으로 v1 에서는 항상 null.
 *
 * [paperSize]·[layoutMode] 는 시리즈 출판 메타(033 R2, null=미설정). 하위 작품 effective 해석의 원천.
 */
data class CategoryResponse(
    val id: Long,
    val name: String,
    val parentId: Long?,
    val sortOrder: Int,
    val projectCount: Int,
    val paperSize: String?,
    val layoutMode: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
