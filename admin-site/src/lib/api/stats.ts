import { apiFetch } from "./client";

/** 어드민 통계(030 US3). */
export interface StatsSummary {
    totalUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    activeUsers: number;
    totalProjects: number;
}

export interface SignupPoint {
    date: string;
    count: number;
}

export interface SignupTrend {
    points: SignupPoint[];
}

export function getStatsSummary(): Promise<StatsSummary> {
    return apiFetch<StatsSummary>("/api/admin/stats/summary", { method: "GET" });
}

export function getSignups(days = 30): Promise<SignupTrend> {
    return apiFetch<SignupTrend>(`/api/admin/stats/signups?days=${days}`, { method: "GET" });
}
