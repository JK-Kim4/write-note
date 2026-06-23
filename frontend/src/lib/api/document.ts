import { apiFetch } from "./client";
import type { DocumentResponse, DocumentSaveResponse } from "@/types/api";

/**
 * 문서 API (006 US1 자동저장 계약). 033: 챕터 제거 — 작품 1개 = 본문 1개.
 *
 * - GET /api/projects/{projectId}/document — 작품의 단일 본문 열기
 * - GET /api/documents/{id} — ID 기반 본문 조회
 * - PUT /api/documents/{id} — 본문 저장 (409 시 ConflictError — client.ts 처리)
 */

export function getProjectDocument(projectId: number): Promise<DocumentResponse> {
    return apiFetch<DocumentResponse>(`/api/projects/${projectId}/document`, { method: "GET" });
}

export function getDocument(id: number): Promise<DocumentResponse> {
    return apiFetch<DocumentResponse>(`/api/documents/${id}`, { method: "GET" });
}

export interface SaveDocumentInput {
    body: string;
    /** 016 — 세션이 소유한 불투명 버전 토큰(ISO8601 문자열). 받은 값 그대로 전달. */
    version: string;
}

export function saveDocument(id: number, input: SaveDocumentInput): Promise<DocumentSaveResponse> {
    return apiFetch<DocumentSaveResponse>(`/api/documents/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}
