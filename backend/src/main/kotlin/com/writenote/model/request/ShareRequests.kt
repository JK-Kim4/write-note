package com.writenote.model.request

import jakarta.validation.constraints.NotBlank

// 공유하기(046) 요청 DTO 모음.

/** 공유 링크 생성 — [targetType]="work"|"series"(R1=work), [targetId]=project.id 또는 category.id. */
data class CreateShareLinkRequest(
    @field:NotBlank
    val targetType: String,
    val targetId: Long,
)

/** 공유 링크 상태 변경 — revoke([isActive]=false). */
data class UpdateShareLinkRequest(
    val isActive: Boolean,
)

/**
 * 시리즈 공유 링크의 공개 작품 목록 설정(046 R3) — [projectIds] = 공개할 작품 id 목록(그 시리즈 소속만).
 * 추가분은 그 시점 스냅샷 동결, 제거분은 스냅샷 삭제. 빈 목록 = 전체 비공개.
 */
data class SetPublicWorksRequest(
    val projectIds: List<Long> = emptyList(),
)

/**
 * 위치 지정 댓글 작성(046 R2) — 불변 스냅샷의 ([anchorBlockIndex] top-level 블록 + [anchorStart] 문단 내 오프셋 + [anchorLength] 구간 길이).
 * 음수·범위 초과는 서버가 [com.writenote.error.ShareErrorCode.COMMENT_ANCHOR_INVALID] 로 판정(여기서 @Min 미부착 — 도메인 코드 보존).
 */
data class CreateCommentRequest(
    val anchorBlockIndex: Int,
    val anchorStart: Int,
    val anchorLength: Int,
    @field:NotBlank
    val content: String,
)
