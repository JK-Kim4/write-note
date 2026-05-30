package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

/** 모바일 캡처 요청 (M6 POST /api/capture). source=MOBILE 자동, active_project 없음. */
data class MobileCaptureRequest(
    @field:NotBlank(message = "body 는 비어있을 수 없습니다.")
    val body: String,
)
