"use client";

import { lastSentence } from "@/lib/lastSentence";
import type { ProjectCard } from "@/lib/types/domain";

type Props = {
    card: ProjectCard;
    /** 카드 전체 진입 — 집필실 이동은 부모 책임. */
    onOpen: () => void;
};

/** 작품 미니 카드(018 US4 ④) — 최근작 제외 나머지 작품의 빠른 진입. 표시 전용. */
export function WorkMiniCard({ card, onOpen }: Props) {
    const sentence = lastSentence(card.lastSentenceSource);

    return (
        <button type="button" className="work-card" onClick={onOpen}>
            <p className="work-card__t">{card.title}</p>
            <p className="work-card__s">{sentence ? `“…${sentence}”` : "아직 첫 문장을 기다리는 중"}</p>
        </button>
    );
}
