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
    /** "다음에 쓸 장면" 한 줄 (014 backend 확장). 미설정은 빈 문자열. */
    nextScene: string;
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

/** 메모에 연결된 등장인물 (006 US4) — MemoProjectResponse.characters 원소 */
export interface MemoCharacterResponse {
    characterId: number;
    name: string;
}

/** 메모에 연결된 프로젝트 (006 US4) — MemoResponse.projects 원소 */
export interface MemoProjectResponse {
    projectId: number;
    title: string;
    characters: MemoCharacterResponse[];
}

/** 메모 응답 (006 US3/US4) — GET /api/memos, POST /api/memos, PUT /api/memos/{id}/curation */
export interface MemoResponse {
    id: number;
    body: string;
    source: string;
    capturedAt: string;
    activeProjectAtCapture: number | null;
    reasonNote: string | null;
    tags: string[];
    projects: MemoProjectResponse[];
}

/** 토큰 목록 항목 — GET /api/api-tokens 응답 원소 (token 필드 없음) */
export interface ApiTokenListItem {
    id: number;
    tokenPrefix: string;
    label: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    revokedAt: string | null;
}

/** 토큰 발급 응답 — POST /api/api-tokens (원본 token 1회만 포함) */
export interface ApiTokenIssueResponse {
    id: number;
    token: string; // "wnt_..." — 이 응답에서만 노출, 재조회 불가
    tokenPrefix: string;
    label: string | null;
    createdAt: string;
}

/** label 수정 응답 — PATCH /api/api-tokens/{id} */
export interface ApiTokenResponse {
    id: number;
    tokenPrefix: string;
    label: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    revokedAt: string | null;
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
