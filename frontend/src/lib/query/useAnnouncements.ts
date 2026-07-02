"use client";

/**
 * 공개 공지 React Query 훅 (030 운영 툴) — 홈 배너 + /notice 목록·상세.
 * 기존 src/lib/api/announcements 재사용. 공지는 자주 안 바뀌어 staleTime 넉넉히.
 */
import { useQuery } from "@tanstack/react-query";
import {
    getAnnouncement,
    getHomeAnnouncements,
    listAnnouncements,
    type AnnouncementDetail,
    type AnnouncementSummary,
    type HomeAnnouncements,
} from "@/lib/api/announcements";
import type { Page } from "@/types/api";

const STALE_MS = 60_000;

export const announcementKeys = {
    all: ["announcements"] as const,
    list: (page: number, size: number) => [...announcementKeys.all, "list", page, size] as const,
    home: () => [...announcementKeys.all, "home"] as const,
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

/** 홈 배너 — 고정 슬롯 + 최신 슬롯 두 개(각 없으면 null). */
export function useHomeAnnouncements() {
    return useQuery<HomeAnnouncements>({
        queryKey: announcementKeys.home(),
        queryFn: getHomeAnnouncements,
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
