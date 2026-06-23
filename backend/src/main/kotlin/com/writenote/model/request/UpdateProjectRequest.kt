package com.writenote.model.request

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size

/**
 * 작품 부분 수정 요청 — null 필드는 미변경. 장르·줄거리·톤류(toneNotes/worldNotes/nextScene)
 * 변경 경로는 시리즈로 이동(033 R3)하여 제거됐다 — 구 클라이언트가 보내도 Jackson 이 무시(400 아님).
 * Project 의 해당 컬럼·값은 보존되며 본 요청으로 더 이상 변경되지 않을 뿐이다(FR-014).
 */
data class UpdateProjectRequest(
    @field:Size(min = 1, max = 120)
    val title: String? = null,
    @field:Min(1)
    @field:Max(100_000_000)
    val targetLength: Int? = null,
    @field:Size(max = 16)
    val paperSize: String? = null,
    @field:Size(max = 16)
    val layoutMode: String? = null,
    @field:Size(max = 2)
    val fontScale: String? = null,
)
