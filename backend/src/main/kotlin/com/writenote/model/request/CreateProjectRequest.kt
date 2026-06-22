package com.writenote.model.request

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/**
 * 작품 생성 요청. 장르·줄거리·톤류(toneNotes/worldNotes/nextScene)는 시리즈로 이동(033 R3)하여
 * 본 요청에서 제거됐다 — 구 클라이언트가 보내도 Jackson 이 unknown 필드로 무시(400 아님).
 * [title]·[targetLength]·[paperSize]·[layoutMode]·[fontScale] 만 작품에 반영된다.
 */
data class CreateProjectRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val title: String,
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
