"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { barScale } from "@/lib/dashboardView";
import { formatDuration } from "@/lib/progress";

type Props = {
    dayMs: ReadonlyArray<number>;
    todayIndex: number;
    /** 오늘 막대 강조용 날짜 라벨(예: "6/20"). 미전달 시 "오늘" 표식만 강조(028 US1). */
    todayDateLabel?: string;
    /** A형 RhythmCard 시그니처 호환 + 작품별 누적 막대(추후) 용 — 현재 요일 막대만 표시. */
    cards: ReadonlyArray<ProjectCard>;
};

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function BRhythmCard({ dayMs, todayIndex, todayDateLabel }: Props) {
    const scaled = barScale(dayMs);
    const isEmpty = dayMs.every((ms) => ms <= 0);
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">집필 리듬 (이번 주)</p>
            {isEmpty ? (
                <div className="mt-3 flex h-24 items-center justify-center">
                    <p className="text-sm text-gray-400">아직 이번 주 기록이 없어요</p>
                </div>
            ) : (
                <div className="mt-3 flex items-end gap-2">
                    {scaled.map((h, i) => {
                        const isToday = i === todayIndex;
                        const durationLabel = formatDuration(dayMs[i]);
                        return (
                            <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
                                {/* 호버 툴팁 — 그날 작업시간. pointer-events-none 으로 막대 호버를 방해하지 않음.
                                    title 폴백(아래 막대)이 접근성·모바일 long-press 를 커버. */}
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                    {durationLabel}
                                </div>
                                {/* 막대 트랙 — definite 높이(h-24) + relative. 막대는 absolute bottom-0 로
                                    이 트랙(definite)에 % 높이를 해석시킨다(게이지와 동일 패턴). 트랙 없이 막대를
                                    normal-flow 로 두면 부모 칼럼이 auto 높이라 % 가 0 으로 붕괴해 막대가 안 보인다. */}
                                <div className="relative h-24 w-full">
                                    <div
                                        data-testid="rhythm-bar"
                                        data-today={isToday}
                                        title={durationLabel}
                                        className={`absolute inset-x-0 bottom-0 rounded-sm ${isToday ? "bg-terracotta-600" : "bg-terracotta-200"}`}
                                        style={{ height: `${Math.max(4, h * 100)}%` }}
                                    />
                                </div>
                                {isToday ? (
                                    <span className="flex flex-col items-center leading-tight">
                                        <span className="rounded-sm bg-terracotta-600 px-1 text-[9px] font-bold text-white">
                                            오늘
                                        </span>
                                        <span className="text-[10px] font-semibold text-terracotta-700">
                                            {todayDateLabel ?? DAYS[i]}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-gray-400">{DAYS[i]}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
