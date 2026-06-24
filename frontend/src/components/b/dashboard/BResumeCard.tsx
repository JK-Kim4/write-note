"use client";

import type { ProjectCard } from "@/lib/types/domain";
import { formatRelativeTime } from "@/lib/dashboardView";
import { lastSentence } from "@/lib/lastSentence";
import { GoalGauge } from "./GoalGauge";

type Props = { card: ProjectCard; onOpen: () => void };

export function BResumeCard({ card, onOpen }: Props) {
    const sentence = lastSentence(card.lastSentenceSource);
    // 마지막 문장 앞에 다른 내용이 있을 때만 … 표시(본문이 한 문장뿐이면 잘린 듯 보이지 않게 생략).
    const hasPreceding = sentence !== null && card.lastSentenceSource.trim() !== sentence;
    const meta = [
        card.categoryName ?? "미분류",
        `${formatRelativeTime(card.docUpdatedAt, new Date())} 저장`,
        `${card.wordCount.toLocaleString()}자`,
    ].join(" · ");

    return (
        <div className="rounded-xl border border-l-4 border-border border-l-terracotta-600 bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">이어서 쓰기</p>
            <h2 className="mt-1 text-lg font-bold text-ink">{card.title}</h2>
            {sentence ? (
                <p className="mt-1 line-clamp-2 break-all italic text-ink-2">&ldquo;{hasPreceding ? "…" : ""}{sentence}&rdquo;</p>
            ) : (
                <p className="mt-1 italic text-faint">아직 첫 문장을 기다리는 중</p>
            )}
            <p className="mt-2 text-xs text-faint">{meta}</p>
            <GoalGauge wordCount={card.wordCount} targetLength={card.targetLength} />
            <button
                type="button"
                onClick={onOpen}
                className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-terracotta-700"
            >
                이어 쓰기 →
            </button>
        </div>
    );
}
