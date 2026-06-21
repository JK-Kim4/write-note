"use client";

import { useQuery } from "@tanstack/react-query";
import { getSignups, getStatsSummary, type SignupTrend, type StatsSummary } from "@/lib/api/stats";

export const adminStatsKeys = {
    all: ["admin", "stats"] as const,
    summary: () => [...adminStatsKeys.all, "summary"] as const,
    signups: (days: number) => [...adminStatsKeys.all, "signups", days] as const,
};

export function useStatsSummary() {
    return useQuery<StatsSummary>({
        queryKey: adminStatsKeys.summary(),
        queryFn: getStatsSummary,
    });
}

export function useSignups(days = 30) {
    return useQuery<SignupTrend>({
        queryKey: adminStatsKeys.signups(days),
        queryFn: () => getSignups(days),
    });
}
