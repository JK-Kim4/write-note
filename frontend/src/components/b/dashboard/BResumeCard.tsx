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
        `${formatRelativeTime(card.docUpdatedAt, new Date())} 저장`,
        `${card.wordCount.toLocaleString()}자`,
    ].join(" · ");

    return (
        <div className="rounded-xl border border-l-4 border-gray-200 border-l-indigo-600 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">이어서 쓰기</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{card.title}</h2>
            {sentence ? (
                <p className="mt-1 italic text-gray-700">&ldquo;{hasPreceding ? "…" : ""}{sentence}&rdquo;</p>
            ) : (
                <p className="mt-1 italic text-gray-400">아직 첫 문장을 기다리는 중</p>
            )}
            {card.nextScene !== "" && (
                <p className="mt-2 text-xs text-gray-500">
                    다음 장면 · <b>{card.nextScene}</b>
                </p>
            )}
            <p className="mt-1 text-xs text-gray-400">{meta}</p>
            <GoalGauge wordCount={card.wordCount} targetLength={card.targetLength} />
            <button
                type="button"
                onClick={onOpen}
                className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
                이어 쓰기 →
            </button>
        </div>
    );
}
