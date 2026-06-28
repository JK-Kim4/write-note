"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { formatDurationKo } from "@/lib/formatDuration";
import { SharePopover } from "@/components/share/SharePopover";
import { activeLinkCount, linksForTarget } from "@/lib/share/shareGrouping";
import type { ShareLinkResponse } from "@/lib/api/share";
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
    /** 내 공유 링크 전체(047) — 이 작품의 활성 링크 수·공유 진입점용. 호스트에서 1회 조회해 내림. */
    shareLinks?: ShareLinkResponse[];
    /** DragOverlay 렌더용 — 드래그 리스너/링크 비활성, 시각만. */
    overlay?: boolean;
};

/**
 * 작품 카드 — 기존 WorkCard 비주얼 + @dnd-kit 드래그(마우스로 시리즈 타일에 끌어 분류).
 * 터치/키보드용 시리즈 이동은 '편집' 모달의 시리즈 드롭다운으로 처리(카드 오버레이 ⋯ 제거).
 * 047 — 편집·보관·삭제와 나란히 "공유" 버튼(SharePopover) + 활성 링크 1개+면 좌상단 "● 공유 중 · N".
 */
export function DraggableWorkCard({ card, onDelete, onEdit, onArchive, shareLinks, overlay }: DraggableWorkCardProps) {
    const router = useRouter();
    const [shareOpen, setShareOpen] = useState(false);
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: workDragId(card.id),
        disabled: overlay,
    });

    const myLinks = shareLinks ? linksForTarget(shareLinks, "work", card.id) : [];
    const activeCount = activeLinkCount(myLinks);

    const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

    // 카드 전체(가장자리·여백 포함)를 진입 클릭 영역으로 — 모든 이벤트가 모이는 카드 div 에서 처리.
    // 드래그 시 dnd-kit 이 click 을 document 캡처 단계에서 막으므로 오진입 없음. 링크/버튼 클릭은 각자 처리.
    const handleCardClick = (e: React.MouseEvent) => {
        // 카드 위에 뜬 공유 팝오버·모달 내부 클릭은 작품 진입으로 보지 않는다(SharePopover=role=dialog, 이벤트 누수 가드).
        if ((e.target as HTMLElement).closest("a, button, input, textarea, select, [role=dialog], [role=menu]")) return;
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
                shareOpen ? "z-30" : ""
            } ${overlay ? "rotate-[-2deg] shadow-xl" : ""} ${isDragging ? "opacity-40" : ""}`}
        >
            {overlay ? <div className="block">{body}</div> : (
                // 텍스트 영역은 링크로(키보드 Enter·새 탭 열기 보존), 가장자리·여백은 위 카드 div onClick 이 처리.
                <Link href={`/works/${card.id}`} className="block" draggable={false}>
                    {body}
                </Link>
            )}

            {!overlay && activeCount > 0 ? (
                // flow 밖 absolute — 배지 유무로 제목 위치가 밀리지 않게(레이아웃 일치). 우상단.
                <span className="absolute right-3 top-3 z-[5] inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-teal-600 shadow-sm">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-600" /> 공유 중 · {activeCount}
                </span>
            ) : null}

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
                        data-share-trigger
                        aria-label={`${card.title} 공유`}
                        aria-expanded={shareOpen}
                        {...stopDrag}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShareOpen((v) => !v);
                        }}
                        className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text hover:bg-terracotta-100"
                    >
                        공유{myLinks.length > 0 ? ` ${myLinks.length}` : ""}
                    </button>
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

            {!overlay && shareOpen && (
                <SharePopover
                    targetType="work"
                    targetId={card.id}
                    title={card.title}
                    onClose={() => setShareOpen(false)}
                    positionClassName="right-3 bottom-12"
                />
            )}
        </div>
    );
}
