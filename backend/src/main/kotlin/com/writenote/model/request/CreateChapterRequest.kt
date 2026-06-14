package com.writenote.model.request

data class CreateChapterRequest(
    /** 챕터 제목. null 또는 빈 값이면 서비스에서 "새 챕터" 기본값으로 채움. */
    val title: String? = null,
)
