"use client";

/**
 * logs React Query 훅 (015 US3) — 기록 화면 카드 집계 + 작품별 기록 lazy 조회.
 * endWithLog 는 useWorkSession 이 closedRef 와 함께 소유하므로, 무효화는 호출부(집필실)가 logKeys.all 로 수행.
 */
import { useQuery } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";

export const logKeys = {
    all: ["logs"] as const,
    cards: () => [...logKeys.all, "cards"] as const,
    byProject: (projectId: number) => [...logKeys.all, "project", projectId] as const,
};

/** 기록 화면 — 작품별 진척 카드(집계, R6). */
export function useLogCards() {
    return useQuery({
        queryKey: logKeys.cards(),
        queryFn: () => webElectronApi.logs.list(),
    });
}

/** LogCard 아코디언 펼침 시 그 작품의 누적 기록 — enabled 로 lazy 조회. */
export function useProjectLogs(projectId: number, enabled: boolean) {
    return useQuery({
        queryKey: logKeys.byProject(projectId),
        queryFn: () => webElectronApi.logs.listByProject(projectId),
        enabled: enabled && Number.isFinite(projectId),
    });
}
