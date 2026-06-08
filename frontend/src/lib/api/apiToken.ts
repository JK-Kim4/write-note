import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ApiTokenResponse, ApiTokenIssueResponse, ApiTokenListItem } from "@/types/api";

/**
 * 모바일 캡처 API 토큰 (006 US5).
 *
 * - POST  /api/api-tokens         — 토큰 발급 (원본 token 1회 응답)
 * - GET   /api/api-tokens         — 토큰 목록 (token 필드 없음)
 * - PATCH /api/api-tokens/{id}    — label 수정
 * - DELETE /api/api-tokens/{id}   — 토큰 해지 (204)
 */

export interface IssueTokenInput {
    label?: string;
}

export interface UpdateTokenLabelInput {
    label: string;
}

const QUERY_KEY = ["api-tokens"] as const;

// ─── fetch 함수 ──────────────────────────────────────────────────────────────

export function issueToken(input: IssueTokenInput): Promise<ApiTokenIssueResponse> {
    return apiFetch<ApiTokenIssueResponse>("/api/api-tokens", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function listTokens(): Promise<ApiTokenListItem[]> {
    return apiFetch<ApiTokenListItem[]>("/api/api-tokens", { method: "GET" });
}

export function updateTokenLabel(id: number, input: UpdateTokenLabelInput): Promise<ApiTokenResponse> {
    return apiFetch<ApiTokenResponse>(`/api/api-tokens/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function revokeToken(id: number): Promise<void> {
    return apiFetch<void>(`/api/api-tokens/${id}`, { method: "DELETE" });
}

// ─── React Query 훅 ──────────────────────────────────────────────────────────

/** 토큰 목록 조회 훅 */
export function useApiTokens() {
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: listTokens,
    });
}

/** 토큰 발급 훅 — 성공 시 목록 invalidate */
export function useIssueToken() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: issueToken,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}

/** label 수정 훅 — 성공 시 목록 invalidate */
export function useUpdateTokenLabel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateTokenLabelInput }) =>
            updateTokenLabel(id, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}

/** 토큰 해지 훅 — 성공 시 목록 invalidate */
export function useRevokeToken() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: revokeToken,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
    });
}
