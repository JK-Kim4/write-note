import { apiFetch } from "./client";
import type { DocumentResponse, DocumentSaveResponse, DocumentTitleResponse } from "@/types/api";

/**
 * 문서 API (006 US1 자동저장 계약).
 *
 * - GET /api/projects/{projectId}/document — 활성 프로젝트 문서 열기
 * - GET /api/documents/{id} — ID 기반 문서 조회
 * - PUT /api/documents/{id} — 본문 저장 (409 시 ConflictError — client.ts 처리)
 * - PATCH /api/documents/{id}/title — 제목만 업데이트
 */

export function getProjectDocument(projectId: number): Promise<DocumentResponse> {
    return apiFetch<DocumentResponse>(`/api/projects/${projectId}/document`, { method: "GET" });
}

export function getDocument(id: number): Promise<DocumentResponse> {
    return apiFetch<DocumentResponse>(`/api/documents/${id}`, { method: "GET" });
}

export interface SaveDocumentInput {
    body: string;
    version: number;
}

export function saveDocument(id: number, input: SaveDocumentInput): Promise<DocumentSaveResponse> {
    return apiFetch<DocumentSaveResponse>(`/api/documents/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}

export interface UpdateTitleInput {
    title: string;
}

export function updateDocumentTitle(id: number, input: UpdateTitleInput): Promise<DocumentTitleResponse> {
    return apiFetch<DocumentTitleResponse>(`/api/documents/${id}/title`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
