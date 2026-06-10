"use client";

import { formatRelativeTime } from "@/lib/dashboardView";
import { lastSentence } from "@/lib/lastSentence";
import { formatDuration } from "@/lib/progress";
import type { ProjectCard } from "@/lib/types/domain";

type Props = {
    card: ProjectCard;
    /** 타일·버튼 공통 진입 — 집필실 이동은 부모 책임. */
    onOpen: () => void;
};

/**
 * 이어서 쓰기 타일(018 US1 ②) — 최근작의 재진입 맥락(제목·마지막 문장·다음 장면·메타) 표시 전용.
 * 누적 작업시간 0 은 토막 숨김, 다음 장면 빈 문자열은 줄 숨김(압박 없는 빈 상태).
 */
export function ResumeCard({ card, onOpen }: Props) {
    const sentence = lastSentence(card.lastSentenceSource);
    const meta = [
        `${formatRelativeTime(card.docUpdatedAt, new Date())} 저장`,
        `${card.wordCount.toLocaleString()}자`,
        ...(card.totalDurationMs > 0 ? [`총 ${formatDuration(card.totalDurationMs)}`] : []),
    ].join(" · ");

    return (
        <div className="resume">
            <h2 className="resume__title">{card.title}</h2>
            {sentence ? (
                <p className="resume__last">“{sentence}”</p>
            ) : (
                <p className="resume__last resume__last--empty">아직 첫 문장을 기다리는 중</p>
            )}
            {card.nextScene !== "" && (
                <p className="resume__next">
                    다음 장면 · <b>{card.nextScene}</b>
                </p>
            )}
            <div className="resume__foot">
                <span className="resume__meta">{meta}</span>
                <button type="button" className="btn btn--primary" onClick={onOpen}>
                    이어서 쓰기 →
                </button>
            </div>
        </div>
    );
}
