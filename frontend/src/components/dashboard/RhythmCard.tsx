"use client";

import { barScale } from "@/lib/dashboardView";
import { formatDuration } from "@/lib/progress";
import type { ProjectCard } from "@/lib/types/domain";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

type Props = {
    /** 이번 주 요일별(월~일) 작업시간 ms. */
    dayMs: ReadonlyArray<number>;
    /** 오늘 인덱스(월=0 … 일=6). */
    todayIndex: number;
    /** 작품 카드(누적 작업시간 포함) — 작품별 절은 누적 > 0 만 내림차순. */
    cards: ReadonlyArray<ProjectCard>;
};

/**
 * 집필 리듬 카드(018 v4 ③) — 주간 요일 막대 + 작품별 누적 가로 막대. 표시 전용.
 * 평가·압박 장치(목표 게이지·등급·배지) 없음 — 사실 표시만(원칙 4 v2).
 */
export function RhythmCard({ dayMs, todayIndex, cards }: Props) {
    const totalMs = dayMs.reduce((a, b) => a + b, 0);
    const heights = barScale(dayMs);

    const ranked = cards.filter((c) => c.totalDurationMs > 0).sort((a, b) => b.totalDurationMs - a.totalDurationMs);
    const cumulativeMs = ranked.reduce((a, c) => a + c.totalDurationMs, 0);
    const widths = barScale(ranked.map((c) => c.totalDurationMs));

    return (
        <div className="rhythm-side">
            <h3 className="rhythm-side__h">이번 주</h3>
            <p className="rhythm-side__total">{totalMs > 0 ? formatDuration(totalMs) : "기록 없음"}</p>
            <div className="week-bars" aria-hidden="true">
                {heights.map((h, i) => (
                    <div
                        key={DAY_LABELS[i]}
                        className={`bar${i === todayIndex ? " bar--today" : ""}${dayMs[i] === 0 ? " bar--zero" : ""}`}
                        style={dayMs[i] === 0 ? undefined : { height: `${Math.max(8, Math.round(h * 100))}%` }}
                    />
                ))}
            </div>
            <div className="week-days">
                {DAY_LABELS.map((label, i) => (
                    <span key={label} className={i === todayIndex ? "today" : undefined}>
                        {label}
                    </span>
                ))}
            </div>
            {ranked.length > 0 && (
                <>
                    <hr className="rhythm-side__hr" />
                    <h3 className="rhythm-side__h">작품별 쌓인 시간 · 총 {formatDuration(cumulativeMs)}</h3>
                    <div className="proj-rows">
                        {ranked.map((card, i) => (
                            <div key={card.id}>
                                <p className="proj-row__name">{card.title}</p>
                                <div className="proj-row__bar">
                                    <div className="proj-row__track">
                                        <div
                                            className={`proj-row__fill${i === 0 ? " proj-row__fill--top" : ""}`}
                                            style={{ width: `${Math.max(4, Math.round(widths[i] * 100))}%` }}
                                        />
                                    </div>
                                    <span className="proj-row__time">{formatDuration(card.totalDurationMs)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
