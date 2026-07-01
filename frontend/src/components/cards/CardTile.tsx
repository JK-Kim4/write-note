"use client";

import { kindOf } from "@/components/board/cardKinds";
import type { CardItem } from "@/lib/api/cards";

/** 카드 관리 그리드의 한 장 — 종류색 틴트 + 본문 미리보기 + 소속 보드/독립 + 연결 배지. */
export function CardTile({ card, onOpen }: { card: CardItem; onOpen: (card: CardItem) => void }) {
    const kind = kindOf(card.type);
    return (
        <button
            type="button"
            onClick={() => onOpen(card)}
            className={`flex min-h-[132px] flex-col rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${kind.bg} ${kind.border}`}
        >
            <p className="line-clamp-3 flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-900">
                {card.body.trim() ? card.body : <span className="text-gray-400">(내용 없음)</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.chip}`}
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${kind.dot}`} />
                    {kind.label}
                </span>
                {card.linkCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-terracotta-50 px-2 py-0.5 text-[11px] font-semibold text-terracotta-700">
                        🔗 {card.linkCount}
                    </span>
                )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                {card.boardId == null ? (
                    <span className="italic text-gray-400">🗂 속한 보드 없음</span>
                ) : (
                    <>
                        <OwnerChip ownerType={card.ownerType} ownerLabel={card.ownerLabel} />
                        <span className="text-gray-400">🕸 {card.boardName}</span>
                    </>
                )}
            </div>
        </button>
    );
}

/** 카드가 속한 보드의 대상(작품/시리즈/아이디어) 칩 — 보드 허브와 같은 색 관례. */
function OwnerChip({ ownerType, ownerLabel }: { ownerType: string | null; ownerLabel: string | null }) {
    const style =
        ownerType === "project"
            ? { text: `작품 · ${ownerLabel}`, cls: "bg-terracotta-50 text-terracotta-700" }
            : ownerType === "category"
              ? { text: `시리즈 · ${ownerLabel}`, cls: "bg-teal-50 text-teal-700" }
              : { text: ownerLabel ?? "아이디어", cls: "bg-gray-100 text-gray-500" };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.cls}`}>
            {style.text}
        </span>
    );
}
