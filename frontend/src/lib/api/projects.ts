import { apiFetch } from "./client";
import type { Page, ProjectResponse } from "@/types/api";

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
