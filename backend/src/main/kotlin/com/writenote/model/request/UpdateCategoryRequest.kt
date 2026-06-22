package com.writenote.model.request

import jakarta.validation.constraints.PositiveOrZero
import jakarta.validation.constraints.Size

/**
 * 모음(시리즈) 부분 수정 — null 필드는 미변경. [name] 이름 변경, [sortOrder] 표시 순서.
 *
 * [paperSize]·[layoutMode] 는 시리즈 출판 메타(033 R2). null=미변경. layoutMode 는 값이 있으면
 * `paper`/`web` 중 하나로 검증한다. [genre]·[synopsis] 는 시리즈 장르·줄거리(033 R3, null=미변경).
 * [targetLength] 는 시리즈 총 목표 분량(033 R4, null=미변경, ≥0).
 */
data class UpdateCategoryRequest(
    @field:Size(min = 1, max = 60)
    val name: String? = null,
    val sortOrder: Int? = null,
    val paperSize: String? = null,
    val layoutMode: String? = null,
    @field:Size(max = 100)
    val genre: String? = null,
    val synopsis: String? = null,
    @field:PositiveOrZero
    val targetLength: Int? = null,
)
