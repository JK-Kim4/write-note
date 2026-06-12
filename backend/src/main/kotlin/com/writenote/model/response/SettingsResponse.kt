package com.writenote.model.response

/**
 * 설정 조회·갱신 응답 (019 US2). 저장된 key 만 포함(미저장 key 는 부재).
 */
data class SettingsResponse(
    val settings: Map<String, String>,
)
