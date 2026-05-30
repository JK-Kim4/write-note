import { apiFetch } from "./client";
import type { Page } from "@/types/api";
import type { MemoResponse } from "@/types/api";

/**
 * 메모 API (006 US3 데스크탑 캡처).
 *
 * - GET  /api/memos           — 메모 목록 (기본 페이징)
 * - POST /api/memos           — 데스크탑 캡처 (source=DESKTOP 자동, JWT 쿠키 인증)
 *
 * Spec reference: 006 US3 backend 계약
 */

export interface ListMemosParams {
    page?: number;
    size?: number;
}

const buildQuery = (params: ListMemosParams): string => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.size !== undefined) search.set("size", String(params.size));
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

export function listMemos(params: ListMemosParams = {}): Promise<Page<MemoResponse>> {
    return apiFetch<Page<MemoResponse>>(`/api/memos${buildQuery(params)}`, { method: "GET" });
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
