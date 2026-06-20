package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 집필 기록 생성 요청 — 독립 생성 경로(spec Q1). */
data class CreateProjectLogRequest(
    @field:NotBlank
    @field:Size(max = 2000)
    val body: String = "",
)
