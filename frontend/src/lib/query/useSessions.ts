"use client";

/**
 * work-sessions React Query 훅 (018 US3, v4) — 집필 리듬 카드의 요일별 작업시간.
 * 기간 합계 endpoint 를 요일별로 병렬 호출(백엔드 변경 0). 오늘 이후 요일은 호출 없이 0.
 * 캐시 키에 주 시작 + 오늘 날짜를 포함 — 주/날짜가 바뀌면 키가 자연 분리된다.
 */
import { useQuery } from "@tanstack/react-query";
import { weekDayRanges } from "@/lib/dashboardView";
import { webElectronApi } from "@/lib/electron-api";

export const sessionKeys = {
    all: ["sessions"] as const,
    weeklyByDay: (weekStartIso: string, todayIso: string) => [...sessionKeys.all, "weeklyByDay", weekStartIso, todayIso] as const,
};

/** 이번 주 요일별(월~일) 작업시간 합계 — `dayMs[7]` + 주간 총합. */
export function useWeeklyByDay() {
    const now = new Date();
    const ranges = weekDayRanges(now);
    const weekStartIso = ranges[0].from.toISOString();
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    return useQuery({
        queryKey: sessionKeys.weeklyByDay(weekStartIso, todayIso),
        queryFn: async () => {
            const dayMs = await Promise.all(
                ranges.map(async ({ from }) => {
                    if (from.getTime() > Date.now()) return 0;
                    const to = new Date(from);
                    to.setDate(from.getDate() + 1);
                    const { totalDurationMs } = await webElectronApi.sessions.rangeTotal(from.toISOString(), to.toISOString());
                    return totalDurationMs;
                }),
            );
            return { dayMs, totalMs: dayMs.reduce((a, b) => a + b, 0) };
        },
    });
}
