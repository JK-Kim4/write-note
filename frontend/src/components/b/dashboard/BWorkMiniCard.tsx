"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { lastSentence } from "@/lib/lastSentence";
import { formatRelativeTime } from "@/lib/dashboardView";
import { formatDurationKo } from "@/lib/formatDuration";
import { GoalGauge } from "./GoalGauge";

type Props = { card: ProjectCard; onOpen: () => void };

/** 생성일 표시용 — YYYY.MM.DD (DraggableWorkCard 호버와 동일 형식). */
function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function BWorkMiniCard({ card, onOpen }: Props) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group relative rounded-xl border border-border bg-surface p-4 text-left transition-shadow hover:shadow-md"
        >
            <h3 className="text-sm font-bold text-ink">{card.title}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                <span className="min-w-0 truncate">{card.categoryName ?? "미분류"}</span>
                <span aria-hidden>·</span>
                <span className="whitespace-nowrap">{formatRelativeTime(card.docUpdatedAt, new Date())} 수정</span>
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{lastSentence(card.lastSentenceSource)}</p>
            <GoalGauge wordCount={card.wordCount} targetLength={card.targetLength} />
            {/* 호버 시 생성일·총 집필 시간 — DraggableWorkCard 패턴 재사용. button 안이라 span(inline). */}
            <span
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-3 z-20 mb-1.5 whitespace-nowrap rounded-lg bg-[#2a2620] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
            >
                {formatDate(card.createdAt)} 생성 · 집필 시간{" "}
                <span className="font-semibold">{formatDurationKo(card.totalDurationMs)}</span>
            </span>
        </button>
    );
}
