package com.writenote.model.response

/** MemoResponse 내 큐레이션된 프로젝트 + 인물 목록. */
data class MemoProjectResponse(
    val projectId: Long,
    val title: String,
    val characters: List<MemoCharacterResponse> = emptyList(),
)

/** MemoProjectResponse 내 인물 단위. */
data class MemoCharacterResponse(
    val characterId: Long,
    val name: String,
)
