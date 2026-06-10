"use client";

/**
 * work-sessions React Query 훅 (018 US3) — 대시보드 "이번 주 집필 시간" 조회.
 * 캐시 키에 주 시작 ISO 를 포함 — 주가 바뀌면 키가 자연 분리된다.
 */
import { useQuery } from "@tanstack/react-query";
import { startOfWeekMonday } from "@/lib/dashboardView";
import { webElectronApi } from "@/lib/electron-api";

export const sessionKeys = {
    all: ["sessions"] as const,
    weeklyTotal: (weekStartIso: string) => [...sessionKeys.all, "weeklyTotal", weekStartIso] as const,
};

/** 이번 주(로컬 월요일 0시 ~ 지금) 전체 작품 작업시간 합계. */
export function useWeeklyTotal() {
    const weekStartIso = startOfWeekMonday(new Date()).toISOString();
    return useQuery({
        queryKey: sessionKeys.weeklyTotal(weekStartIso),
        queryFn: () => webElectronApi.sessions.rangeTotal(weekStartIso, new Date().toISOString()),
    });
}
