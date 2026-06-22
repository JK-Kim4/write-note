package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * 모음(시리즈) 생성 요청. [parentId] 는 N뎁스 설계용이나 v1 은 서비스가 비-null 을 거부(1뎁스 강제, FR-010).
 *
 * [paperSize]·[layoutMode] 는 시리즈 출판 메타(033 R2, optional·null 허용). 값이 있으면 서비스가
 * 허용 식별자 집합으로 검증한다. [genre]·[synopsis] 는 시리즈 장르·줄거리(033 R3, optional·null 허용).
 * (targetLength 는 R4 범위로 본 요청 미노출.)
 */
data class CreateCategoryRequest(
    @field:NotBlank
    @field:Size(max = 60)
    val name: String,
    val parentId: Long? = null,
    val paperSize: String? = null,
    val layoutMode: String? = null,
    @field:Size(max = 100)
    val genre: String? = null,
    val synopsis: String? = null,
)
