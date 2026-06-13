import { apiFetch } from "./client";
import type { ChapterMetaResponse, CreateChapterInput, DocumentResponse, DocumentSaveResponse, DocumentTitleResponse } from "@/types/api";

/**
 * 문서 API (006 US1 자동저장 계약 + 022 US1 챕터 목록·생성).
 *
 * - GET /api/projects/{projectId}/documents — 활성 챕터 목록 (본문 제외 메타)
 * - POST /api/projects/{projectId}/documents — 챕터 생성 (title 생략 시 서버가 "새 챕터" 채움)
 * - GET /api/projects/{projectId}/document — 활성 프로젝트 문서 열기 (레거시, 단수)
 * - GET /api/documents/{id} — ID 기반 문서 조회
 * - PUT /api/documents/{id} — 본문 저장 (409 시 ConflictError — client.ts 처리)
 * - PATCH /api/documents/{id}/title — 제목만 업데이트
 */

/** 챕터 목록 (본문 제외 메타) — GET /api/projects/{projectId}/documents */
export function listChapters(projectId: number): Promise<ChapterMetaResponse[]> {
    return apiFetch<ChapterMetaResponse[]>(`/api/projects/${projectId}/documents`, { method: "GET" });
}

/** 챕터 생성 — POST /api/projects/{projectId}/documents. title 미전달 시 서버가 "새 챕터" 채움. */
export function createChapter(projectId: number, input: CreateChapterInput = {}): Promise<DocumentResponse> {
    return apiFetch<DocumentResponse>(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

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

export interface UpdateTitleInput {
    title: string;
}

export function updateDocumentTitle(id: number, input: UpdateTitleInput): Promise<DocumentTitleResponse> {
    return apiFetch<DocumentTitleResponse>(`/api/documents/${id}/title`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
