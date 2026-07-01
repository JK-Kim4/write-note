package com.writenote.model.response

import java.time.Instant

// 공유하기(046) 응답 DTO 모음.

/**
 * 공유 작품 메타(목록용 — 본문 미포함). work 링크=단일, series 링크=공개 작품 목록.
 * [unreadCommentCount] = 그 작품(projectId)의 안 읽은 피드백 수(047). 작가 listMine 에서만 실제 값(공개 열람은 0).
 */
data class SharedWorkMeta(
    val projectId: Long,
    val title: String,
    val unreadCommentCount: Int = 0,
)

/**
 * 공유 링크 응답(작가). [shareUrl] = 파생(`{frontendBaseUrl}/shared/{token}`).
 * [snapshots] = 동결된 공개 작품 메타(work=1, series=N).
 */
data class ShareLinkResponse(
    val id: Long,
    val token: String,
    val targetType: String,
    val targetId: Long,
    val isActive: Boolean,
    val shareUrl: String,
    val createdAt: Instant,
    val snapshots: List<SharedWorkMeta>,
)

/** 공개 열람 진입(목록) — work 면 단일, series 면 공개 작품 목록. 본문 미포함. */
data class SharedViewResponse(
    val targetType: String,
    val title: String,
    val works: List<SharedWorkMeta>,
)

/**
 * 공개 열람 단건(스냅샷 본문). [bodyJson] = owner 키로 복호된 평문 PM JSON.
 * [comments] = 요청자 본인 댓글만(R1 은 항상 빈 배열, R2 에서 채움).
 * [reactions] = 그 스냅샷의 반응 집계(050 US3, 공개) — 구 FE 는 필드 미사용이라도 무손상(additive).
 */
data class SharedWorkResponse(
    val projectId: Long,
    val title: String,
    val bodyJson: String,
    val comments: List<CommentResponse>,
    val reactions: List<ReactionAggregate> = emptyList(),
)

/**
 * 위치 지정 댓글(046 R2). 공개 read 응답의 [SharedWorkResponse.comments] = 요청자 본인 댓글만(가시성 R-3).
 * [authorNickname] = users.nickname(036) 재사용.
 * 앵커 3필드는 nullable(050 US3) — 셋 다 null = 구간 미지정 "전체 의견".
 */
data class CommentResponse(
    val id: Long,
    val anchorBlockIndex: Int?,
    val anchorStart: Int?,
    val anchorLength: Int?,
    val content: String,
    val authorNickname: String,
    val createdAt: Instant,
)

/**
 * 작가 인박스 댓글(046 R2) — 작가 소유 작품의 전체 댓글(타 열람자 포함). 스냅샷별 그룹핑 가능하도록 [shareSnapshotId] 동봉.
 * [authorNickname] = 댓글 작성자(users.nickname). 앵커 3필드는 nullable(050 US3, 전체 의견).
 */
data class AuthorCommentResponse(
    val id: Long,
    val shareSnapshotId: Long,
    val projectId: Long,
    val anchorBlockIndex: Int?,
    val anchorStart: Int?,
    val anchorLength: Int?,
    val content: String,
    val authorNickname: String,
    val createdAt: Instant,
    val readAt: Instant? = null,
)

/**
 * 반응 집계(050 US3) — 한 스냅샷의 (anchor, emoji) 그룹별 개수. 공개(열람자 전체가 봄).
 * [mine] = 요청자(회원)가 그 (anchor, emoji) 에 반응했는지 — 비로그인은 항상 false.
 */
data class ReactionAggregate(
    val anchorBlockIndex: Int,
    val anchorStart: Int,
    val anchorLength: Int,
    val emoji: String,
    val count: Int,
    val mine: Boolean,
)

/**
 * 작가용 피드백 맥락 뷰(050 US1) — 한 공유 링크(스냅샷)의 본문 전문 + 전체 댓글 + 반응 집계를 한 번에.
 * [bodyJson] = owner 키로 복호된 평문 PM JSON. 비활성(off) 링크도 조회 가능(작가 소유 검증만).
 */
data class AuthorSnapshotFeedbackResponse(
    val projectId: Long,
    val title: String,
    val bodyJson: String,
    val comments: List<AuthorCommentResponse>,
    val reactions: List<ReactionAggregate>,
)

/** 댓글 삭제 결과(046 R2). */
data class DeleteCommentResponse(
    val deleted: Boolean,
)

/** 작품 단위 받은 피드백 읽음 처리 결과(047). [markedRead] = 이번에 안 읽음→읽음으로 바뀐 댓글 수. */
data class MarkCommentsReadResponse(
    val markedRead: Int,
)

/** 공유 링크 삭제 결과(047) — 링크+스냅샷+받은 피드백 영구 삭제(CASCADE). */
data class DeleteShareLinkResponse(
    val deleted: Boolean,
)
