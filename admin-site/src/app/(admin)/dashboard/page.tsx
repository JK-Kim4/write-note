"use client";

import { useStatsSummary, useSignups } from "@/lib/query/useAdminStats";
import type { SignupPoint } from "@/lib/api/stats";

function Card({ label, value }: { label: string; value: number | undefined }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value ?? "—"}</div>
        </div>
    );
}

/** 의존성 없는 인라인 막대 차트 — 30일 가입 추이. */
function SignupChart({ points }: { points: SignupPoint[] }) {
    const max = Math.max(1, ...points.map((p) => p.count));
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-medium text-slate-700">최근 30일 가입 추이</div>
            <div className="flex h-40 items-end gap-0.5">
                {points.map((p) => (
                    <div
                        key={p.date}
                        title={`${p.date}: ${p.count}명`}
                        className="flex-1 rounded-t bg-slate-300 transition-colors hover:bg-slate-500"
                        style={{ height: `${Math.max(2, (p.count / max) * 100)}%` }}
                    />
                ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{points[0]?.date}</span>
                <span>{points[points.length - 1]?.date}</span>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const summary = useStatsSummary();
    const signups = useSignups(30);
    const s = summary.data;

    return (
        <div>
            <h1 className="mb-5 text-lg font-bold text-slate-900">사용 현황</h1>

            {summary.isError && <p className="mb-4 text-sm text-slate-500">통계를 불러오지 못했습니다.</p>}

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Card label="총 가입자" value={s?.totalUsers} />
                <Card label="오늘 신규" value={s?.newUsersToday} />
                <Card label="이번 주 신규" value={s?.newUsersThisWeek} />
                <Card label="활성 사용자(7일)" value={s?.activeUsers} />
                <Card label="총 작품" value={s?.totalProjects} />
            </div>

            {signups.isLoading && <p className="text-sm text-slate-500">추이 불러오는 중…</p>}
            {signups.data && <SignupChart points={signups.data.points} />}
        </div>
    );
}
