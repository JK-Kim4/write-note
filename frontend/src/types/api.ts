/**
 * Backend API 응답 envelope 타입.
 *
 * Phase 1A (specs/001-phase-1a-backend-scaffold/contracts/project-api.md) 1:1 정합.
 * 본 spec contracts/api-client.md §3 인용.
 */

import type { PaperSize } from "@/components/editor/pageLayout";

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
    /** 작품별 용지 크기 (트랙3 / V12). 백엔드 CHECK 로 4종 보장. */
    paperSize: PaperSize;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

/** 작품 카드 집계 (018) — GET /api/projects/cards. 작품 + 문서·세션 집계 동봉(본문 미포함). */
export interface ProjectCardResponse extends ProjectResponse {
    /** 문서 글자수 (document.word_count). */
    wordCount: number;
    /** 문서 저장 시각 (document.updated_at, ISO8601) — "최근에 집필함" 기준. */
    documentUpdatedAt: string;
    /** 작품별 누적 작업시간(ms) — 종료된 세션 합(진행 중 제외). */
    totalDurationMs: number;
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
    age: string | null;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
    traits: string | null;
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
    /** 016 — updatedAt 겸용 불투명 버전 토큰(ISO8601 문자열). 파싱·증감 금지, 받은 값 그대로 전달. */
    version: string;
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

/** 작품 맥락 메모 응답 (014) — GET /api/projects/{id}/memos, PUT …/pin. id 는 memoId. */
export interface ProjectMemoResponse {
    memoId: number;
    projectId: number;
    body: string;
    source: string;
    capturedAt: string;
    reasonNote: string | null;
    tags: string[];
    pinned: boolean;
}

/** 집필 기록 응답 (014) — GET/POST /api/projects/{id}/logs. desktop ProjectLog 대응. */
export interface ProjectLogResponse {
    id: number;
    projectId: number;
    body: string;
    createdAt: string;
}

/** 작업 세션 응답 (014). endedAt=null 이면 진행 중. */
export interface WorkSessionResponse {
    id: number;
    projectId: number;
    startedAt: string;
    endedAt: string | null;
}

/** 종료+기록 결과 (014) — 보존된 세션(없으면 null) + 생성된 집필 기록. */
export interface EndWithLogResponse {
    session: WorkSessionResponse | null;
    log: ProjectLogResponse;
}

/** 총 작업시간(ms) 응답 (014) — 카드 집계용. */
export interface TotalDurationResponse {
    totalDurationMs: number;
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
    /** 016 — flush 후 확정된 새 버전 토큰(ISO8601 문자열, 불투명). */
    version: string;
    updatedAt: string;
}

/** PATCH /api/documents/{id}/title 성공 응답 */
export interface DocumentTitleResponse {
    id: number;
    title: string;
    updatedAt: string;
}
