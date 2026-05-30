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
