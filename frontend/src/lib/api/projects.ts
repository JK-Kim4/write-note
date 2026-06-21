import { apiFetch } from "./client";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { FontScale, LayoutMode, Page, ProjectCardResponse, ProjectResponse } from "@/types/api";

/**
 * Projects placeholder query — Phase 1A `/api/projects` 호출.
 *
 * Spec reference: contracts/api-client.md §5-1 + spec.md §FR-020
 * 본 spec 단계의 사용처: app/page.tsx 의 홈 동적 변형 분기.
 *
 * 풀 사용 (Create / Get / Update / Archive) 은 Week 2 의 Project CRUD UI.
 */

export interface ListProjectsParams {
    page?: number;
    size?: number;
    sort?: string;
}

const buildQuery = (params: ListProjectsParams): string => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.size !== undefined) search.set("size", String(params.size));
    if (params.sort) search.set("sort", params.sort);
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

export function listProjects(params: ListProjectsParams = {}): Promise<Page<ProjectResponse>> {
    return apiFetch<Page<ProjectResponse>>(`/api/projects${buildQuery(params)}`, {
        method: "GET",
    });
}

/** 카드 집계(018) — 활성 작품 전량 + 글자수·문서 저장 시각·누적 작업시간(본문 미포함). */
export function listProjectCards(): Promise<ProjectCardResponse[]> {
    return apiFetch<ProjectCardResponse[]>("/api/projects/cards", { method: "GET" });
}

export interface CreateProjectInput {
    title: string;
    genre?: string | null;
    targetLength?: number | null;
    toneNotes?: string | null;
    synopsis?: string | null;
    worldNotes?: string | null;
    /** "다음에 쓸 장면" 한 줄 (014). 부분 수정 시 빈 문자열 = 비우기. */
    nextScene?: string;
    /** 작품별 용지 크기 (트랙3). 미지정 시 백엔드 기본 A4. */
    paperSize?: PaperSize;
    /** 출판 방식 (031). 생성 시 강제 선택(FE). 미지정 시 백엔드 기본 paper. */
    layoutMode?: LayoutMode;
    /** 글자 크기 5단 (031 US5). 미지정 시 백엔드 기본 m(보통). 조절은 집필실에서. */
    fontScale?: FontScale;
}

export function createProject(input: CreateProjectInput): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>("/api/projects", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function getProject(id: number): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>(`/api/projects/${id}`, { method: "GET" });
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export function updateProject(id: number, input: UpdateProjectInput): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function archiveProject(id: number): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>(`/api/projects/${id}/archive`, { method: "POST" });
}

export function unarchiveProject(id: number): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>(`/api/projects/${id}/unarchive`, { method: "POST" });
}

export function deleteProject(id: number): Promise<void> {
    return apiFetch<void>(`/api/projects/${id}`, { method: "DELETE" });
}
