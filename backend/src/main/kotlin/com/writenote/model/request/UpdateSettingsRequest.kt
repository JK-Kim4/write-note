package com.writenote.model.request

/**
 * 설정 부분 갱신 요청 (019 US2). settings 에 보낸 key 만 upsert(per-key last-write-wins).
 * 허용 key·value 는 SettingsService allowlist 가 검증.
 */
data class UpdateSettingsRequest(
    val settings: Map<String, String> = emptyMap(),
)
