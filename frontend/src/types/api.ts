/**
 * Backend API 응답 envelope 타입.
 *
 * Phase 1A (specs/001-phase-1a-backend-scaffold/contracts/project-api.md) 1:1 정합.
 * 본 spec contracts/api-client.md §3 인용.
 */

export type Result<T> = SuccessResult<T> | FailureResult;

export interface SuccessResult<T> {
    success: true;
    data: T;
    error: null;
}

export interface FailureResult {
    success: false;
    data: null;
    error: ErrorInfo;
}

export interface ErrorInfo {
    code: string;
    message: string;
}

export interface Page<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

export interface ProjectResponse {
    id: number;
    title: string;
    genre: string | null;
    targetLength: number | null;
    toneNotes: string | null;
    synopsis: string | null;
    worldNotes: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AuthMeResponse {
    userId: number;
    email: string;
    kakaoLinked: boolean;
    emailVerifiedAt: string | null;
    activeApiTokenCount: number;
}

export interface CharacterResponse {
    id: number;
    projectId: number;
    name: string;
    shortDescription: string | null;
    notes: string | null;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
}

/** 문서 응답 (006 US1) — GET /api/projects/{projectId}/document, GET /api/documents/{id} */
export interface DocumentResponse {
    id: number;
    projectId: number;
    title: string;
    body: string; // ProseMirror JSON 문자열
    wordCount: number;
    version: number;
    updatedAt: string;
}

/** 메모 응답 (006 US3) — GET /api/memos, POST /api/memos */
export interface MemoResponse {
    id: number;
    body: string;
    source: string;
    capturedAt: string;
    activeProjectAtCapture: number | null;
    reasonNote: string | null;
    tags: string[];
    projects: number[];
}

/** PUT /api/documents/{id} 성공 응답 */
export interface DocumentSaveResponse {
    id: number;
    body: string;
    wordCount: number;
    version: number;
    updatedAt: string;
}

/** PATCH /api/documents/{id}/title 성공 응답 */
export interface DocumentTitleResponse {
    id: number;
    title: string;
    updatedAt: string;
}
