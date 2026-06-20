package com.writenote.model.request

/** 곁쪽지 고정 토글 요청 — `memos:setPin` 대응. */
data class SetPinRequest(
    val pinned: Boolean = false,
)
