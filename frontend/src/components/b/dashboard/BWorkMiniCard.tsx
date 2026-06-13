"use client";
import type { ProjectCard } from "@/lib/types/domain";
import { lastSentence } from "@/lib/lastSentence";
import { GoalGauge } from "./GoalGauge";

type Props = { card: ProjectCard; onOpen: () => void };

export function BWorkMiniCard({ card, onOpen }: Props) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
        >
            <h3 className="text-sm font-bold text-gray-900">{card.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{lastSentence(card.lastSentenceSource)}</p>
            <GoalGauge wordCount={card.wordCount} targetLength={card.targetLength} />
        </button>
    );
}
