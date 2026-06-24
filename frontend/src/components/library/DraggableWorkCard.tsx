"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { formatDurationKo } from "@/lib/formatDuration";
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
    const router = useRouter();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: workDragId(card.id),
        disabled: overlay,
    });

    const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

    // 카드 전체(가장자리·여백 포함)를 진입 클릭 영역으로 — 모든 이벤트가 모이는 카드 div 에서 처리.
    // 드래그 시 dnd-kit 이 click 을 document 캡처 단계에서 막으므로 오진입 없음. 링크/버튼 클릭은 각자 처리.
    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(`/works/${card.id}`);
    };

    const body = (
        <>
            <h2 className="text-lg font-bold text-ink">{card.title}</h2>
            <div className="mt-3 flex items-center gap-3 text-xs text-faint">
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
            onClick={overlay ? undefined : handleCardClick}
            className={`group relative cursor-pointer select-none rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-md ${
                overlay ? "rotate-[-2deg] shadow-xl" : ""
            } ${isDragging ? "opacity-40" : ""}`}
        >
            {overlay ? <div className="block">{body}</div> : (
                // 텍스트 영역은 링크로(키보드 Enter·새 탭 열기 보존), 가장자리·여백은 위 카드 div onClick 이 처리.
                <Link href={`/works/${card.id}`} className="block" draggable={false}>
                    {body}
                </Link>
            )}

            {!overlay && (
                <div
                    role="tooltip"
                    className="pointer-events-none invisible absolute bottom-full left-3 z-20 mb-1.5 whitespace-nowrap rounded-lg bg-[#2a2620] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100"
                >
                    {formatDate(card.createdAt)} 생성 · 집필 시간 <span className="font-semibold">{formatDurationKo(card.totalDurationMs)}</span>
                </div>
            )}
            {!overlay && (
                <div className="absolute right-3 bottom-3 z-10 flex gap-1">
                    <button
                        type="button"
                        aria-label={`${card.title} 편집`}
                        {...stopDrag}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEdit(card);
                        }}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-strong hover:bg-surface-2"
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
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-strong hover:bg-surface-2"
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
