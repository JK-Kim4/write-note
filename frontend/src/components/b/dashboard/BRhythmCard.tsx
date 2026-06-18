"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { barScale } from "@/lib/dashboardView";

type Props = {
    dayMs: ReadonlyArray<number>;
    todayIndex: number;
    /** A형 RhythmCard 시그니처 호환 + 작품별 누적 막대(추후) 용 — 현재 요일 막대만 표시. */
    cards: ReadonlyArray<ProjectCard>;
};

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function BRhythmCard({ dayMs, todayIndex }: Props) {
    const scaled = barScale(dayMs);
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">집필 리듬 (이번 주)</p>
            <div className="mt-3 flex h-24 items-end gap-2">
                {scaled.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div
                            data-testid="rhythm-bar"
                            data-today={i === todayIndex}
                            className={`w-full rounded-sm ${i === todayIndex ? "bg-terracotta-600" : "bg-terracotta-200"}`}
                            style={{ height: `${Math.max(4, h * 100)}%` }}
                        />
                        <span className="text-[10px] text-gray-400">{DAYS[i]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
