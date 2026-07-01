import { apiFetch } from "./client";
import type { Page } from "@/types/api";

/**
 * 공개 공지 API (030 운영 툴) — 비인증 허용, 공개된 공지만 반환.
 *
 * `GET /api/announcements`(목록, 본문 제외) / `GET /api/announcements/{id}`(상세, 본문 포함).
 */

/** 공개 공지 목록 항목 — 본문 제외. */
export interface AnnouncementSummary {
    id: number;
    title: string;
    publishedAt: string | null;
}

/** 공개 공지 상세 — 본문 포함. */
export interface AnnouncementDetail {
    id: number;
    title: string;
    body: string;
    publishedAt: string | null;
}

export interface ListAnnouncementsParams {
    page?: number;
    size?: number;
}

const buildQuery = (params: ListAnnouncementsParams): string => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.size !== undefined) search.set("size", String(params.size));
    const qs = search.toString();
    return qs ? `?${qs}` : "";
};

export function listAnnouncements(params: ListAnnouncementsParams = {}): Promise<Page<AnnouncementSummary>> {
    return apiFetch<Page<AnnouncementSummary>>(`/api/announcements${buildQuery(params)}`, { method: "GET" });
}

export function getAnnouncement(id: number): Promise<AnnouncementDetail> {
    return apiFetch<AnnouncementDetail>(`/api/announcements/${id}`, { method: "GET" });
}

/** 홈 두 슬롯 — 고정/최신 각각 요약(없으면 null). */
export interface HomeAnnouncements {
    pinned: AnnouncementSummary | null;
    latest: AnnouncementSummary | null;
}

export function getHomeAnnouncements(): Promise<HomeAnnouncements> {
    return apiFetch<HomeAnnouncements>(`/api/announcements/home`, { method: "GET" });
}
