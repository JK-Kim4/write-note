import { apiFetch } from "./client";
import type { CategoryResponse, ProjectResponse } from "@/types/api";

/**
 * 모음(카테고리, 032) HTTP 클라이언트 — `/api/categories` + 작품 이동.
 * 신규 에러코드 0(404/400 재사용). 작품 이동은 전용 엔드포인트(null=미분류).
 */

export function listCategories(): Promise<CategoryResponse[]> {
    return apiFetch<CategoryResponse[]>("/api/categories", { method: "GET" });
}

export function createCategory(name: string): Promise<CategoryResponse> {
    return apiFetch<CategoryResponse>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
    });
}

export interface UpdateCategoryInput {
    name?: string;
    sortOrder?: number;
}

export function updateCategory(id: number, input: UpdateCategoryInput): Promise<CategoryResponse> {
    return apiFetch<CategoryResponse>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function deleteCategory(id: number): Promise<void> {
    return apiFetch<void>(`/api/categories/${id}`, { method: "DELETE" });
}

/** 작품을 모음으로 이동 — categoryId null = 미분류로 빼냄. */
export function moveProjectCategory(projectId: number, categoryId: number | null): Promise<ProjectResponse> {
    return apiFetch<ProjectResponse>(`/api/projects/${projectId}/category`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId }),
    });
}
