import { apiFetch, type Page } from "./client";

/** 어드민 공지 (030) — 공개/비공개 전체 + CRUD. */
export interface AdminAnnouncement {
    id: number;
    title: string;
    body: string;
    isPublished: boolean;
    isPinned: boolean;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AnnouncementInput {
    title: string;
    body: string;
    isPublished: boolean;
    isPinned: boolean;
}

export function listAdminAnnouncements(page = 0, size = 50): Promise<Page<AdminAnnouncement>> {
    return apiFetch<Page<AdminAnnouncement>>(`/api/admin/announcements?page=${page}&size=${size}`, { method: "GET" });
}

export function createAnnouncement(input: AnnouncementInput): Promise<AdminAnnouncement> {
    return apiFetch<AdminAnnouncement>("/api/admin/announcements", { method: "POST", body: JSON.stringify(input) });
}

export function updateAnnouncement(id: number, input: AnnouncementInput): Promise<AdminAnnouncement> {
    return apiFetch<AdminAnnouncement>(`/api/admin/announcements/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteAnnouncement(id: number): Promise<void> {
    return apiFetch<void>(`/api/admin/announcements/${id}`, { method: "DELETE" });
}
