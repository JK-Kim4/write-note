package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

/** 데스크탑 캡처 요청 (M3 POST /api/memos). */
data class CaptureMemoRequest(
    @field:NotBlank(message = "body 는 비어있을 수 없습니다.")
    val body: String,
    /** 작성 중인 프로젝트 ID (nullable — 프로젝트 비활성 상태 허용) */
    val activeProjectId: Long? = null,
)
