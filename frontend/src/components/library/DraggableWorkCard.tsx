"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import type { ProjectCard } from "@/lib/types/domain";

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export const workDragId = (id: number) => `work:${id}`;

type DraggableWorkCardProps = {
    card: ProjectCard;
    onDelete: (card: ProjectCard) => void;
    onEdit: (card: ProjectCard) => void;
    onArchive: (id: number) => void;
    /** DragOverlay 렌더용 — 드래그 리스너/링크 비활성, 시각만. */
    overlay?: boolean;
};

/**
 * 작품 카드 — 기존 WorkCard 비주얼 + @dnd-kit 드래그(마우스로 시리즈 타일에 끌어 분류).
 * 터치/키보드용 시리즈 이동은 '편집' 모달의 시리즈 드롭다운으로 처리(카드 오버레이 ⋯ 제거).
 */
export function DraggableWorkCard({ card, onDelete, onEdit, onArchive, overlay }: DraggableWorkCardProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: workDragId(card.id),
        disabled: overlay,
    });

    const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

    const body = (
        <>
            <h2 className="text-lg font-bold text-gray-900">{card.title}</h2>
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                <span>{card.wordCount.toLocaleString()}자</span>
                <span>마지막 저장 {formatDate(card.docUpdatedAt)}</span>
            </div>
        </>
    );

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            {...(overlay ? {} : listeners)}
            {...(overlay ? {} : attributes)}
            className={`group relative cursor-grab rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md active:cursor-grabbing ${
                overlay ? "rotate-[-2deg] shadow-xl" : ""
            } ${isDragging ? "opacity-40" : ""}`}
        >
            {overlay ? <div className="block">{body}</div> : (
                <Link href={`/works/${card.id}`} className="block" draggable={false}>
                    {body}
                </Link>
            )}

            {!overlay && (
                <div className="absolute right-3 bottom-3 flex gap-1">
                    <button
                        type="button"
                        aria-label={`${card.title} 편집`}
                        {...stopDrag}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEdit(card);
                        }}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                        편집
                    </button>
                    <button
                        type="button"
                        aria-label={`${card.title} 보관`}
                        {...stopDrag}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onArchive(card.id);
                        }}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                        보관
                    </button>
                    <button
                        type="button"
                        aria-label={`${card.title} 삭제`}
                        {...stopDrag}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(card);
                        }}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}
