package com.writenote.model.request

import jakarta.validation.constraints.Size

/**
 * 모음(시리즈) 부분 수정 — null 필드는 미변경. [name] 이름 변경, [sortOrder] 표시 순서.
 *
 * [paperSize]·[layoutMode] 는 시리즈 출판 메타(033 R2). null=미변경. layoutMode 는 값이 있으면
 * `paper`/`web` 중 하나로 검증한다. (genre/synopsis/targetLength 는 R3/R4 범위로 본 요청 미노출.)
 */
data class UpdateCategoryRequest(
    @field:Size(min = 1, max = 60)
    val name: String? = null,
    val sortOrder: Int? = null,
    val paperSize: String? = null,
    val layoutMode: String? = null,
)
