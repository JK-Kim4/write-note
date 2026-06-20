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
    allTime: () => [...sessionKeys.all, "allTime"] as const,
};

/**
 * 전체 작업시간 합계(트랙2) — user 단위. 작품을 삭제해도 보존된 세션이 합계에 남는다.
 * "작품별 작업시간"(per-project, 활성 작품만)과 별도. 충분히 넓은 범위로 모든 종료 세션 포함.
 */
export function useAllTimeTotal() {
    return useQuery({
        queryKey: sessionKeys.allTime(),
        queryFn: async () => {
            const { totalDurationMs } = await webElectronApi.sessions.rangeTotal(
                "1970-01-01T00:00:00.000Z",
                "2100-01-01T00:00:00.000Z",
            );
            return totalDurationMs;
        },
    });
}

/** 이번 주 요일별(월~일) 작업시간 합계 — `dayMs[7]` + 주간 총합. */
export function useWeeklyByDay() {
    const now = new Date();
    const ranges = weekDayRanges(now);
    const weekStartIso = ranges[0].from.toISOString();
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    return useQuery({
        queryKey: sessionKeys.weeklyByDay(weekStartIso, todayIso),
        // 집필 후 홈 복귀(컴포넌트 mount)마다 강제 재요청 — 기본 staleTime 60s 캐시로 인한 미반영 방지(028 US1).
        refetchOnMount: "always",
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
