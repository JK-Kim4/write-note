"use client";
import { gaugeFill, formatDurationMinutes, formatTodayDuration, isGoalReached } from "@/lib/todayGauge";

/**
 * 오늘 작업시간 원통형 게이지(028 US2).
 * 데이터는 기존 주간 집계 dayMs[today] 재사용 — 신규 fetch 없음.
 */
export function BTodayGauge({ todayMs, goalMinutes }: { todayMs: number; goalMinutes: number }) {
    const fill = gaugeFill(todayMs, goalMinutes);
    const reached = isGoalReached(todayMs, goalMinutes);
    const todayLabel = formatTodayDuration(todayMs);
    const goalLabel = formatDurationMinutes(goalMinutes);

    return (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            {/* 세로 원통 — 아래에서 위로 채움 */}
            <div
                role="progressbar"
                aria-label="오늘 작업시간"
                aria-valuenow={Math.round(fill * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-24 w-10 overflow-hidden rounded-full bg-terracotta-100"
            >
                <span
                    className={`absolute inset-x-0 bottom-0 block rounded-full transition-[height] duration-500 ${
                        reached ? "bg-accent" : "bg-terracotta-400"
                    }`}
                    style={{ height: `${fill * 100}%` }}
                />
            </div>

            <div className="flex flex-col">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">오늘 작업</p>
                <p className="mt-1 text-lg font-bold text-ink">{todayLabel}</p>
                <p className="text-xs text-faint">목표 {goalLabel}</p>
                {reached ? <p className="mt-1 text-xs font-semibold text-accent-text">목표 달성 🎉</p> : null}
            </div>
        </div>
    );
}
