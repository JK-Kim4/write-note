package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 작업 종료 + 기록 요청 — `sessions:endWithLog` 대응. */
data class EndWithLogRequest(
    @field:NotBlank
    @field:Size(max = 2000)
    val body: String = "",
)
