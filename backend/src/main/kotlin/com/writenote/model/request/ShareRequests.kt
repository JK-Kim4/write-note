package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

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
 * 위치 지정 댓글 작성(046 R2) — 불변 스냅샷의 ([anchorBlockIndex] 평탄화 블록 인덱스 + [anchorStart] 블록 내 오프셋 + [anchorLength] 구간 길이).
 * 블록 모델은 프론트 pmConvert 평탄화와 동형(목록=항목별·인용=단락별·hardBreak 1글자, [com.writenote.service.AnchorValidator]).
 * 음수·범위 초과는 서버가 [com.writenote.error.ShareErrorCode.COMMENT_ANCHOR_INVALID] 로 판정(여기서 @Min 미부착 — 도메인 코드 보존).
 * [content] 상한 2000자(M1) — 초과 시 @Valid 가 400 VALIDATION_FAILED.
 */
data class CreateCommentRequest(
    val anchorBlockIndex: Int,
    val anchorStart: Int,
    val anchorLength: Int,
    @field:NotBlank
    @field:Size(max = 2000, message = "댓글은 2000자 이하여야 합니다")
    val content: String,
)
