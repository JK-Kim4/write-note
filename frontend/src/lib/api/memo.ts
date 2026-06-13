import { apiFetch } from "./client";
import type { Page } from "@/types/api";
import type { MemoResponse, ProjectMemoResponse } from "@/types/api";

/**
 * 메모 API (006 US3 데스크탑 캡처 + US4 큐레이션).
 *
 * - GET   /api/memos                — 메모 목록 (필터/페이징)
 * - POST  /api/memos                — 데스크탑 캡처 (source=DESKTOP 자동, JWT 쿠키 인증)
 * - PUT   /api/memos/{id}/curation  — 큐레이션 저장 (US4)
 * - PATCH /api/memos/{id}           — 메모 부분 수정 (US4)
 * - DELETE /api/memos/{id}          — 메모 삭제 (US4)
 *
 * Spec reference: 006 US3/US4 backend 계약
 */

export interface ListMemosParams {
    page?: number;
    size?: number;
    sort?: string;
    unclassified?: boolean;
    projectId?: number;
    characterId?: number;
    tag?: string;
    q?: string;
}

const buildQuery = (params: ListMemosParams): string => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.size !== undefined) search.set("size", String(params.size));
    if (params.sort) search.set("sort", params.sort);
    if (params.unclassified === true) search.set("unclassified", "true");
    if (params.projectId !== undefined) search.set("projectId", String(params.projectId));
    if (params.characterId !== undefined) search.set("characterId", String(params.characterId));
    if (params.tag) search.set("tag", params.tag);
    if (params.q) search.set("q", params.q);
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

export function listMemos(params: ListMemosParams = {}): Promise<Page<MemoResponse>> {
    return apiFetch<Page<MemoResponse>>(`/api/memos${buildQuery(params)}`, { method: "GET" });
}

/** GET /api/memos/{id} — 단건(연결·태그·사유 포함). addLink/removeLink 가 현재 큐레이션 상태를 읽는 데 사용. */
export function getMemo(id: number): Promise<MemoResponse> {
    return apiFetch<MemoResponse>(`/api/memos/${id}`, { method: "GET" });
}

/** GET /api/projects/{projectId}/memos — 작품에 연결된 메모(고정 포함, 014). */
export function listProjectMemos(projectId: number): Promise<ProjectMemoResponse[]> {
    return apiFetch<ProjectMemoResponse[]>(`/api/projects/${projectId}/memos`, { method: "GET" });
}

/** PUT /api/projects/{projectId}/memos/{memoId}/pin — 메모 고정 토글(작품당 1개, 014). */
export function setProjectMemoPin(projectId: number, memoId: number, pinned: boolean): Promise<ProjectMemoResponse> {
    return apiFetch<ProjectMemoResponse>(`/api/projects/${projectId}/memos/${memoId}/pin`, {
        method: "PUT",
        body: JSON.stringify({ pinned }),
    });
}

export interface CaptureMemoInput {
    body: string;
    activeProjectId?: number | null;
}

export function captureMemo(input: CaptureMemoInput): Promise<MemoResponse> {
    return apiFetch<MemoResponse>("/api/memos", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

/** PUT /api/memos/{id}/curation — 큐레이션 저장 요청 본문 */
export interface CurationInput {
    projectConnections: Array<{
        projectId: number;
        characterIds: number[];
    }>;
    tags: string[];
    reasonNote: string | null;
}

export function curateMemo(id: number, input: CurationInput): Promise<MemoResponse> {
    return apiFetch<MemoResponse>(`/api/memos/${id}/curation`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}

/** PATCH /api/memos/{id} — 메모 부분 수정 */
export interface PatchMemoInput {
    body?: string;
    reasonNote?: string | null;
    tags?: string[];
}

export function patchMemo(id: number, input: PatchMemoInput): Promise<MemoResponse> {
    return apiFetch<MemoResponse>(`/api/memos/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

/** DELETE /api/memos/{id} — 버리기(soft-delete, 연결 보존). 멱등. */
export function deleteMemo(id: number): Promise<void> {
    return apiFetch<void>(`/api/memos/${id}`, { method: "DELETE" });
}

/** POST /api/memos/{id}/restore — 버린 메모 되돌리기(연결·고정 복귀). 멱등. */
export function restoreMemo(id: number): Promise<MemoResponse> {
    return apiFetch<MemoResponse>(`/api/memos/${id}/restore`, { method: "POST" });
}
