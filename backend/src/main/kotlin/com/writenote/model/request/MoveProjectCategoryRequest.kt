package com.writenote.model.request

/**
 * 작품을 모음으로 이동 — `PATCH /api/projects/{id}/category`.
 *
 * [categoryId] null(또는 생략) = 미분류로 빼냄. 기존 `UpdateProjectRequest`(null=미변경)와
 * 의미가 달라 전용 요청으로 분리한다(null-vs-absent 모호 회피).
 */
data class MoveProjectCategoryRequest(
    val categoryId: Long? = null,
)
