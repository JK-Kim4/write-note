import { apiFetch } from "./client";

/**
 * 공유하기(046) HTTP 클라이언트 — `/api/share-links` · `/api/shared` · `/api/share-comments`.
 *
 * 작가 링크 관리(authenticated) + 작가 댓글 인박스. 공개 열람/회원 댓글 작성은 R5(별도).
 * 050(공유 고도화) 추가: 작가 맥락 뷰(링크·스냅샷 단위 전체 피드백) · 이모지 반응 · 전체 의견(앵커 optional).
 *
 * 에러 코드(ShareErrorCode) — client.ts 의 generic 경로가 `error.code` 를 `ApiError.code` 로 전달.
 * 호출부는 `err instanceof ApiError && err.code === ...` 로 분기한다(신규 status 분기는 client.ts 에 추가 안 함):
 *  - SHARE_LINK_NOT_FOUND(404, 비활성·미존재 동형) · SHARE_TARGET_NOT_FOUND(404)
 *  - SHARE_TARGET_INVALID(400) · SHARE_FORBIDDEN(403)
 *  - COMMENT_NOT_FOUND(404) · COMMENT_FORBIDDEN(403) · COMMENT_ANCHOR_INVALID(400) · COMMENT_UNAUTHENTICATED(401)
 *  - REACTION_EMOJI_INVALID(400, 050 신규)
 */

/** 공유 대상 종류 — "work"=작품(즉시 스냅샷 동결), "series"=시리즈(공개 작품은 PUT 으로 선택). */
export type ShareTargetType = "work" | "series";

/** 작품/시리즈당 공유 링크 생성 한도(047, 백엔드 ShareService.MAX_LINKS_PER_TARGET 동기). 끄진 것 포함 총합. */
export const MAX_SHARE_LINKS_PER_TARGET = 5;

/** 공유 작품 메타(목록용 — 본문 미포함). work 링크=단일, series 링크=공개 작품 목록. */
export interface SharedWorkMeta {
    projectId: number;
    title: string;
    /** 그 작품(projectId)의 안 읽은 피드백 수(047). 작가 listMine 에서만 실제 값(공개 열람은 0). */
    unreadCommentCount: number;
}

/** 공유 링크(작가). shareUrl=파생(`{base}/shared/{token}`). snapshots=동결된 공개 작품 메타. */
export interface ShareLinkResponse {
    id: number;
    token: string;
    targetType: ShareTargetType;
    targetId: number;
    isActive: boolean;
    shareUrl: string;
    createdAt: string;
    snapshots: SharedWorkMeta[];
}

/**
 * 작가 인박스 댓글 — 작가 소유 작품의 전체 댓글(타 열람자 포함). authorNickname=작성자(users.nickname).
 *
 * 050: 앵커 3필드가 `number | null` 로 확장 — 셋 다 null 이면 구간 미지정 "전체 의견"(FR-014).
 */
export interface AuthorCommentResponse {
    id: number;
    shareSnapshotId: number;
    projectId: number;
    /** 공유본 top-level 블록(문단) 인덱스(0-base). null=전체 의견(구간 미지정). */
    anchorBlockIndex: number | null;
    /** 문단 내 시작 오프셋(0-base). null=전체 의견. */
    anchorStart: number | null;
    /** 선택 구간 길이(글자 수). null=전체 의견. */
    anchorLength: number | null;
    content: string;
    authorNickname: string;
    createdAt: string;
    /** 작가 확인 시각(047). null=안 읽음(인박스 강조용). */
    readAt: string | null;
}

/** 구간별 이모지 반응 공개 집계(050 US3) — 개별 반응자 신원은 비공개, 개수만 공개(FR-013). */
export interface ReactionAggregate {
    anchorBlockIndex: number;
    anchorStart: number;
    anchorLength: number;
    emoji: string;
    /** 그 구간·이모지에 반응한 회원 수. */
    count: number;
    /** 요청자(회원) 본인이 누른 반응인지. 비로그인은 항상 false. */
    mine: boolean;
}

/** 작가 맥락 뷰(050 US1) — 한 공유 링크(스냅샷) 범위의 전문 + 전체 피드백 + 반응 집계를 한 번에. */
export interface AuthorSnapshotFeedback {
    projectId: number;
    title: string;
    bodyJson: string;
    /** 그 스냅샷에 달린 전체 댓글(작가 권한 — 타 열람자 포함, 전체 의견은 앵커 null). */
    comments: AuthorCommentResponse[];
    reactions: ReactionAggregate[];
}

/** 내 공유 링크 목록(최근순, 스냅샷 메타 동봉). */
export function listMyShareLinks(): Promise<ShareLinkResponse[]> {
    return apiFetch<ShareLinkResponse[]>("/api/share-links/mine", { method: "GET" });
}

/** 공유 링크 생성 — work=즉시 스냅샷 동결, series=링크만(공개 작품은 setPublicWorks 로). */
export function createShareLink(targetType: ShareTargetType, targetId: number): Promise<ShareLinkResponse> {
    return apiFetch<ShareLinkResponse>("/api/share-links", {
        method: "POST",
        body: JSON.stringify({ targetType, targetId }),
    });
}

/** 공유 링크 상태 변경 — isActive=false(끄기)/true(다시 켜기). 본인 링크만. */
export function setShareLinkActive(id: number, isActive: boolean): Promise<ShareLinkResponse> {
    return apiFetch<ShareLinkResponse>(`/api/share-links/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
    });
}

/** 공유 링크 영구 삭제(047) — 링크+스냅샷+받은 피드백 함께 제거(CASCADE). 본인 링크만, 한도 슬롯 회수용. */
export function deleteShareLink(id: number): Promise<{ deleted: boolean }> {
    return apiFetch<{ deleted: boolean }>(`/api/share-links/${id}`, { method: "DELETE" });
}

/** 시리즈 공개 작품 선택(series 전용) — 추가분 스냅샷 동결, 제거분 스냅샷 삭제. 빈 목록=전체 비공개. */
export function setPublicWorks(id: number, projectIds: number[]): Promise<ShareLinkResponse> {
    return apiFetch<ShareLinkResponse>(`/api/share-links/${id}/works`, {
        method: "PUT",
        body: JSON.stringify({ projectIds }),
    });
}

/** 작가 댓글 인박스 — 소유 작품의 전체 댓글(최근순). 타 작품 403. */
export function authorComments(projectId: number): Promise<AuthorCommentResponse[]> {
    return apiFetch<AuthorCommentResponse[]>(`/api/projects/${projectId}/comments`, { method: "GET" });
}

/** 댓글 삭제 — 작성자 본인만(타인 댓글 403). 200 + { deleted: true }. */
export function deleteComment(id: number): Promise<{ deleted: boolean }> {
    return apiFetch<{ deleted: boolean }>(`/api/share-comments/${id}`, { method: "DELETE" });
}

/** 작품 단위 받은 피드백 읽음 처리(047) — 그 작품의 안 읽은 피드백 전체 read_at 채움. 소유 작가만(타 작품 403). */
export function markCommentsRead(projectId: number): Promise<{ markedRead: number }> {
    return apiFetch<{ markedRead: number }>(`/api/projects/${projectId}/comments/read`, { method: "POST" });
}

/**
 * 작가 맥락 뷰 조회(050 US1) — 그 공유 링크(스냅샷) 전문 + 전체 피드백 + 반응 집계. 소유 작가만(타인 403
 * SHARE_FORBIDDEN). 비활성(off) 링크도 열람 가능.
 */
export function getAuthorFeedback(linkId: number, projectId: number): Promise<AuthorSnapshotFeedback> {
    return apiFetch<AuthorSnapshotFeedback>(`/api/share-links/${linkId}/works/${projectId}/feedback`, {
        method: "GET",
    });
}

/**
 * 스냅샷 스코프 받은 피드백 읽음 처리(050 US1, D7) — 그 링크(스냅샷)의 안 읽은 피드백만 read_at 채움.
 * 같은 작품을 여러 번 공유했어도 다른 링크의 안 읽음은 유지된다(047 projectId 단위 read 와 구분).
 */
export function markSnapshotCommentsRead(linkId: number, projectId: number): Promise<{ markedRead: number }> {
    return apiFetch<{ markedRead: number }>(`/api/share-links/${linkId}/works/${projectId}/comments/read`, {
        method: "POST",
    });
}

// ─── 공개 열람 (R5, permitAll — 비로그인 200) ────────────────────────────────

/** 공개 열람 진입(목록). work=단일, series=공개 작품 목록. 비활성/미존재 토큰은 동형 SHARE_LINK_NOT_FOUND(404). */
export interface SharedViewResponse {
    targetType: ShareTargetType;
    /** 작품명(work) 또는 시리즈명(series). */
    title: string;
    works: SharedWorkMeta[];
}

/** 공개 read 응답의 댓글 — 요청자 본인 것만(가시성 R-3, 비로그인이면 빈 배열). 앵커 null=전체 의견(050). */
export interface CommentResponse {
    id: number;
    /** 공유본 top-level 블록(문단) 인덱스(0-base). null=구간 미지정 "전체 의견"(050 FR-014). */
    anchorBlockIndex: number | null;
    anchorStart: number | null;
    anchorLength: number | null;
    content: string;
    authorNickname: string;
    createdAt: string;
}

/** 공개 본문 단건 — bodyJson=owner 키로 복호된 평문 PM JSON, comments=요청자 본인 댓글만. */
export interface SharedWorkResponse {
    projectId: number;
    title: string;
    bodyJson: string;
    comments: CommentResponse[];
    /** 구간별 반응 공개 집계(050 US3, C1 embed). 구 BE(050 배포 전)는 필드가 없을 수 있어 호출부는 `?? []`. */
    reactions: ReactionAggregate[];
}

/**
 * 댓글 작성 입력 — 불변 스냅샷의 (문단 인덱스 + 문단 내 시작·길이) + 본문.
 * 050: 앵커 3필드가 optional — 셋 다 생략하면 구간 미지정 "전체 의견"(FR-014), 셋 다 주면 기존 구간 댓글.
 */
export interface CreateCommentInput {
    anchorBlockIndex?: number;
    anchorStart?: number;
    anchorLength?: number;
    content: string;
}

/** 이모지 반응 화이트리스트(050, BE `ShareErrorCode.ALLOWED_EMOJIS` 와 동기 — research D6). */
export const ALLOWED_REACTION_EMOJIS = ["❤️", "👍", "😮", "😢", "🔥"] as const;

/** 반응 추가/제거 공통 입력 — 구간 앵커(항상 필수) + 이모지. */
export interface CreateReactionInput {
    anchorBlockIndex: number;
    anchorStart: number;
    anchorLength: number;
    emoji: string;
}

/** 공개 열람 진입(목록) — 비로그인 200. 없는/비활성 토큰은 SHARE_LINK_NOT_FOUND(404). */
export function getSharedView(token: string): Promise<SharedViewResponse> {
    return apiFetch<SharedViewResponse>(`/api/shared/${encodeURIComponent(token)}`, { method: "GET" });
}

/** 공개 본문 단건 — 비로그인 200(comments 빈), 회원이면 본인 댓글 동봉. */
export function getSharedWork(token: string, projectId: number): Promise<SharedWorkResponse> {
    return apiFetch<SharedWorkResponse>(
        `/api/shared/${encodeURIComponent(token)}/works/${projectId}`,
        { method: "GET" },
    );
}

/** 댓글 작성(회원 필수) — 비로그인이면 COMMENT_UNAUTHENTICATED(401), 앵커 초과 COMMENT_ANCHOR_INVALID(400). */
export function createComment(
    token: string,
    projectId: number,
    input: CreateCommentInput,
): Promise<CommentResponse> {
    return apiFetch<CommentResponse>(
        `/api/shared/${encodeURIComponent(token)}/works/${projectId}/comments`,
        { method: "POST", body: JSON.stringify(input) },
    );
}

/**
 * 이모지 반응 추가(회원 필수, 050 US3) — 회원·구간·이모지당 unique 라 중복 호출은 멱등(무해).
 * 비로그인 COMMENT_UNAUTHENTICATED(401) · 화이트리스트 밖 REACTION_EMOJI_INVALID(400) · 앵커 무효 COMMENT_ANCHOR_INVALID(400).
 */
export function addReaction(
    token: string,
    projectId: number,
    input: CreateReactionInput,
): Promise<ReactionAggregate> {
    return apiFetch<ReactionAggregate>(
        `/api/shared/${encodeURIComponent(token)}/works/${projectId}/reactions`,
        { method: "POST", body: JSON.stringify(input) },
    );
}

/**
 * 이모지 반응 제거(토글 off, 회원 필수, 050 US3) — DELETE 는 쿼리 파라미터로 전달한다(body 없음,
 * research D3 — 프록시가 DELETE 바디를 신뢰성 없게 다루는 스멜 회피). 요청자 본인 반응만 삭제.
 */
export function removeReaction(
    token: string,
    projectId: number,
    input: CreateReactionInput,
): Promise<ReactionAggregate> {
    const params = new URLSearchParams({
        blockIndex: String(input.anchorBlockIndex),
        start: String(input.anchorStart),
        length: String(input.anchorLength),
        emoji: input.emoji,
    });
    return apiFetch<ReactionAggregate>(
        `/api/shared/${encodeURIComponent(token)}/works/${projectId}/reactions?${params.toString()}`,
        { method: "DELETE" },
    );
}
