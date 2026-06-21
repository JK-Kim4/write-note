import { apiFetch, type Page } from "./client";

/** 어드민 회원 조회(030 US2) — 읽기 전용. */
export interface AdminUser {
    id: number;
    email: string;
    kakaoLinked: boolean;
    emailVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    projectCount: number;
}

export function listUsers(page = 0, size = 20, q?: string): Promise<Page<AdminUser>> {
    const search = new URLSearchParams({ page: String(page), size: String(size) });
    if (q && q.trim() !== "") search.set("q", q.trim());
    return apiFetch<Page<AdminUser>>(`/api/admin/users?${search.toString()}`, { method: "GET" });
}

export function getUser(id: number): Promise<AdminUser> {
    return apiFetch<AdminUser>(`/api/admin/users/${id}`, { method: "GET" });
}
