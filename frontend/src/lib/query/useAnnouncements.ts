"use client";

/**
 * 공개 공지 React Query 훅 (030 운영 툴) — 홈 배너 + /notice 목록·상세.
 * 기존 src/lib/api/announcements 재사용. 공지는 자주 안 바뀌어 staleTime 넉넉히.
 */
import { useQuery } from "@tanstack/react-query";
import {
    getAnnouncement,
    listAnnouncements,
    type AnnouncementDetail,
    type AnnouncementSummary,
} from "@/lib/api/announcements";
import type { Page } from "@/types/api";

const STALE_MS = 60_000;

export const announcementKeys = {
    all: ["announcements"] as const,
    list: (page: number, size: number) => [...announcementKeys.all, "list", page, size] as const,
    latest: () => [...announcementKeys.all, "latest"] as const,
    detail: (id: number) => [...announcementKeys.all, "detail", id] as const,
};

/** 공지 목록(/notice). */
export function useAnnouncements(page = 0, size = 20) {
    return useQuery<Page<AnnouncementSummary>>({
        queryKey: announcementKeys.list(page, size),
        queryFn: () => listAnnouncements({ page, size }),
        staleTime: STALE_MS,
    });
}

/** 홈 배너 — 최신 공개 공지 1건(없으면 null). */
export function useLatestAnnouncement() {
    return useQuery<AnnouncementSummary | null>({
        queryKey: announcementKeys.latest(),
        queryFn: async () => {
            const page = await listAnnouncements({ page: 0, size: 1 });
            return page.content[0] ?? null;
        },
        staleTime: STALE_MS,
    });
}

/** 공지 상세(/notice/[id]). */
export function useAnnouncement(id: number) {
    return useQuery<AnnouncementDetail>({
        queryKey: announcementKeys.detail(id),
        queryFn: () => getAnnouncement(id),
        enabled: Number.isFinite(id) && id > 0,
        staleTime: STALE_MS,
    });
}
