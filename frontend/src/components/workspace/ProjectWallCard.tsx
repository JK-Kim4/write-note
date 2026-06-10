"use client";

import { useState } from "react";
import type { ProjectCardView } from "@/lib/projectView";

type Props = {
    card: ProjectCardView;
    index: number;
    onOpen: () => void;
    /** 다음 장면 한 줄 — blur/엔터로 변경 시에만 호출. */
    onSaveNextScene: (nextScene: string) => void;
    onDelete: () => void;
};

/**
 * 작업 벽 위 작품 한 장 — desktop ProjectWallCard 이식.
 * 얼굴 = 마지막 문장(세리프) / 그 아래 = 작가가 적는 "다음 장면" 한 줄.
 */
export function ProjectWallCard({ card, index, onOpen, onSaveNextScene, onDelete }: Props) {
    const [draft, setDraft] = useState(card.nextScene);

    const commit = () => {
        const next = draft.trim();
        if (next !== card.nextScene) onSaveNextScene(next);
    };

    return (
        <article className="wall-card" style={{ animationDelay: `${index * 50}ms` }}>
            <span className="wall-card__pin" aria-hidden="true" />
            <button type="button" className="wall-card__face" aria-label={`${card.title} 펼치기`} onClick={onOpen}>
                {card.lastSentence ? (
                    <span className="wall-card__sentence">…{card.lastSentence}</span>
                ) : (
                    <span className="wall-card__sentence wall-card__sentence--empty">아직 첫 문장을 기다리는 중</span>
                )}
                <span className="wall-card__title">{card.title}</span>
            </button>

            <div className="wall-card__next">
                <label className="wall-card__next-label" htmlFor={`next-${card.id}`}>
                    다음 장면
                </label>
                <input
                    id={`next-${card.id}`}
                    className="wall-card__next-input"
                    type="text"
                    value={draft}
                    placeholder="여기서부터 이어 써요"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                        }
                    }}
                />
            </div>

            <button type="button" className="wall-card__del" aria-label={`${card.title} 삭제`} onClick={onDelete}>
                <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                    <path d="M10 11v6M14 11v6" />
                </svg>
            </button>
        </article>
    );
}
