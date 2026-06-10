"use client";

import type { OutlineItem } from "@/lib/editor/outline";

type StudioOutlineProps = {
    /** 본문 heading 파생 목차(등장 순서). */
    items: OutlineItem[];
    /** 현재 스크롤 위치가 속한 항목 index(없으면 null). */
    activeIndex: number | null;
    /** 항목 선택 — 원고의 해당 위치로 점프. */
    onSelect: (item: OutlineItem) => void;
};

/**
 * 장면 아웃라인 패널(좌) (017 US1) — heading 파생 목차 표시·점프.
 * presentational(props 전용). 파생/스크롤/점프 글루는 useEditorOutline 훅이 담당.
 */
export function StudioOutline({ items, activeIndex, onSelect }: StudioOutlineProps) {
    return (
        <aside className="studio-outline" aria-label="장면 아웃라인">
            <div className="panel__head">
                <h2 className="panel__title">아웃라인</h2>
            </div>

            {items.length === 0 ? (
                <p className="panel__empty">장면에 큰 제목을 달면 여기 목차가 생겨요.</p>
            ) : (
                <nav className="outline__list">
                    {items.map((item) => {
                        const active = item.index === activeIndex;
                        return (
                            <button
                                key={item.index}
                                type="button"
                                className={`outline__item outline__item--h${item.level}${active ? " is-current" : ""}`}
                                aria-current={active ? "true" : undefined}
                                onClick={() => onSelect(item)}
                            >
                                {item.text || <span className="outline__item--empty">(제목 없음)</span>}
                            </button>
                        );
                    })}
                </nav>
            )}
        </aside>
    );
}
