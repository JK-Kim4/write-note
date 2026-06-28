import { apiFetch } from "./client";

/**
 * 공유하기(046) HTTP 클라이언트 — `/api/share-links` · `/api/shared` · `/api/share-comments`.
 *
 * 작가 링크 관리(authenticated) + 작가 댓글 인박스. 공개 열람/회원 댓글 작성은 R5(별도).
 *
 * 에러 코드(ShareErrorCode) — client.ts 의 generic 경로가 `error.code` 를 `ApiError.code` 로 전달.
 * 호출부는 `err instanceof ApiError && err.code === ...` 로 분기한다(신규 status 분기는 client.ts 에 추가 안 함):
 *  - SHARE_LINK_NOT_FOUND(404, 비활성·미존재 동형) · SHARE_TARGET_NOT_FOUND(404)
 *  - SHARE_TARGET_INVALID(400) · SHARE_FORBIDDEN(403)
 *  - COMMENT_NOT_FOUND(404) · COMMENT_FORBIDDEN(403) · COMMENT_ANCHOR_INVALID(400) · COMMENT_UNAUTHENTICATED(401)
 */

/** 공유 대상 종류 — "work"=작품(즉시 스냅샷 동결), "series"=시리즈(공개 작품은 PUT 으로 선택). */
export type ShareTargetType = "work" | "series";

/** 공유 작품 메타(목록용 — 본문 미포함). work 링크=단일, series 링크=공개 작품 목록. */
export interface SharedWorkMeta {
    projectId: number;
    title: string;
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

/** 작가 인박스 댓글 — 작가 소유 작품의 전체 댓글(타 열람자 포함). authorNickname=작성자(users.nickname). */
export interface AuthorCommentResponse {
    id: number;
    shareSnapshotId: number;
    projectId: number;
    /** 공유본 top-level 블록(문단) 인덱스(0-base). */
    anchorBlockIndex: number;
    /** 문단 내 시작 오프셋(0-base). */
    anchorStart: number;
    /** 선택 구간 길이(글자 수). */
    anchorLength: number;
    content: string;
    authorNickname: string;
    createdAt: string;
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

/** 공유 링크 끄기(revoke) — isActive=false. 본인 링크만. */
export function revokeShareLink(id: number): Promise<ShareLinkResponse> {
    return apiFetch<ShareLinkResponse>(`/api/share-links/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
    });
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

// ─── 공개 열람 (R5, permitAll — 비로그인 200) ────────────────────────────────

/** 공개 열람 진입(목록). work=단일, series=공개 작품 목록. 비활성/미존재 토큰은 동형 SHARE_LINK_NOT_FOUND(404). */
export interface SharedViewResponse {
    targetType: ShareTargetType;
    /** 작품명(work) 또는 시리즈명(series). */
    title: string;
    works: SharedWorkMeta[];
}

/** 공개 read 응답의 댓글 — 요청자 본인 것만(가시성 R-3, 비로그인이면 빈 배열). */
export interface CommentResponse {
    id: number;
    /** 공유본 top-level 블록(문단) 인덱스(0-base). */
    anchorBlockIndex: number;
    anchorStart: number;
    anchorLength: number;
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
}

/** 댓글 작성 입력 — 불변 스냅샷의 (문단 인덱스 + 문단 내 시작·길이) + 본문. */
export interface CreateCommentInput {
    anchorBlockIndex: number;
    anchorStart: number;
    anchorLength: number;
    content: string;
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
