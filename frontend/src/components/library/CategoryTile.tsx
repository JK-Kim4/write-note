"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SeriesPublishFields } from "./SeriesPublishFields";
import { formatDurationKo } from "@/lib/formatDuration";
import type { CategoryResponse, LayoutMode } from "@/types/api";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { ProjectCard } from "@/lib/types/domain";

export const categoryDropId = (id: number) => `cat:${id}`;

/** 책등 장식 — 작품 id 로 시드한 *결정적* 높이/색(매 렌더 고정). 길이 의미 없음, "책 더미" 느낌만. */
const SPINE_COLORS = ["#a8542e", "#76753f", "#087194", "#c77a4f", "#5e5d32", "#8a4325", "#3d8aa3", "#6f361f"];
const SPINE_CAP = 8;
function hashId(id: number): number {
    let h = 2166136261;
    const s = String(id);
    for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 16777619) >>> 0;
    return h >>> 0;
}
const spineHeight = (id: number) => 30 + (hashId(id) % 35);
const spineColor = (id: number) => SPINE_COLORS[hashId(id) % SPINE_COLORS.length];

/** 시리즈 편집 시 보낼 수 있는 변경 필드(033) — 이름 + 메타(장르·줄거리·판형·출판방식). */
export type CategoryUpdateInput = {
    name?: string;
    genre?: string | null;
    synopsis?: string | null;
    paperSize?: PaperSize | null;
    layoutMode?: LayoutMode | null;
    targetLength?: number | null;
};

type CategoryTileProps = {
    category: CategoryResponse;
    works: ProjectCard[];
    onOpen: (id: number) => void;
    onUpdate: (id: number, input: CategoryUpdateInput) => void;
    onDelete: (category: CategoryResponse) => void;
    /** 드롭 직후 흡수 펄스 */
    absorbing?: boolean;
};

/** 시리즈 타일 — 책등 스택 미리보기 + droppable(작품 드롭으로 분류). 단일 클릭=열기, ⋯/이름 클릭=편집(이름·판형·출판방식)·삭제. */
export function CategoryTile({ category, works, onOpen, onUpdate, onDelete, absorbing }: CategoryTileProps) {
    const { setNodeRef, isOver } = useDroppable({ id: categoryDropId(category.id) });
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [genre, setGenre] = useState(category.genre ?? "");
    const [synopsis, setSynopsis] = useState(category.synopsis ?? "");
    const [paperSize, setPaperSize] = useState<PaperSize | null>(category.paperSize);
    const [layoutMode, setLayoutMode] = useState<LayoutMode | null>(category.layoutMode);
    const [targetLength, setTargetLength] = useState<number | null>(category.targetLength);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [menuOpen]);

    const startEditing = () => {
        setName(category.name);
        setGenre(category.genre ?? "");
        setSynopsis(category.synopsis ?? "");
        setPaperSize(category.paperSize);
        setLayoutMode(category.layoutMode);
        setTargetLength(category.targetLength);
        setEditing(true);
    };
    const cancelEditing = () => {
        setName(category.name);
        setGenre(category.genre ?? "");
        setSynopsis(category.synopsis ?? "");
        setPaperSize(category.paperSize);
        setLayoutMode(category.layoutMode);
        setTargetLength(category.targetLength);
        setEditing(false);
    };
    const submitEdit = () => {
        const trimmed = name.trim();
        const next: CategoryUpdateInput = {
            name: trimmed || category.name,
            genre: genre.trim() || null,
            synopsis: synopsis.trim() || null,
            paperSize,
            layoutMode,
            targetLength,
        };
        onUpdate(category.id, next);
        setEditing(false);
    };

    const shown = works.slice(0, SPINE_CAP);

    // 시리즈 진척(033 R4) — 목표 있으면(>0) 비율 막대, 없으면 글자수 텍스트. 0 나눗셈·100% 초과 가드.
    const target = category.targetLength ?? 0;
    const hasTarget = target > 0;
    const progressRatio = hasTarget ? Math.min(1, category.totalWordCount / target) : 0;

    return (
        <div
            ref={setNodeRef}
            role="button"
            tabIndex={0}
            aria-label={`${category.name} 열기`}
            onClick={() => { if (!editing) onOpen(category.id); }}
            onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !editing && e.target === e.currentTarget) {
                    e.preventDefault();
                    onOpen(category.id);
                }
            }}
            style={{ transform: absorbing ? "scale(1.04)" : undefined }}
            className={`relative flex min-h-[150px] cursor-pointer flex-col rounded-2xl border bg-white p-3.5 transition-[transform,box-shadow,border-color] duration-300 ${
                isOver ? "border-terracotta-600 ring-2 ring-terracotta-300" : "border-gray-200 hover:shadow-md"
            }`}
        >
            {/* 책등 스택 */}
            <div className="flex h-16 items-end gap-1 px-0.5">
                {works.length === 0 ? (
                    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-200 text-xs text-gray-400">
                        아직 비어 있어요
                    </div>
                ) : (
                    <>
                        {shown.map((w) => (
                            <div
                                key={w.id}
                                title={w.title}
                                style={{ height: spineHeight(w.id), width: 13, background: spineColor(w.id) }}
                                className="rounded-t-[3px] rounded-b-[1px] shadow-[inset_-2px_0_0_rgba(0,0,0,0.08),0_1px_1px_rgba(42,38,32,0.12)]"
                            />
                        ))}
                        {works.length > SPINE_CAP && (
                            <span className="ml-0.5 self-center text-xs text-gray-400">+{works.length - SPINE_CAP}</span>
                        )}
                    </>
                )}
            </div>

            {/* 이름 + 출판 메타(033 R2) */}
            {editing ? (
                <div onClick={(e) => e.stopPropagation()}>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submitEdit();
                            if (e.key === "Escape") cancelEditing();
                        }}
                        maxLength={60}
                        aria-label="시리즈 이름"
                        className="mt-2.5 w-full rounded-md border border-terracotta-300 px-2 py-1 text-sm font-bold focus:border-terracotta-500 focus:outline-none"
                    />
                    <SeriesPublishFields
                        idPrefix={`series-${category.id}`}
                        genre={genre}
                        synopsis={synopsis}
                        paperSize={paperSize}
                        layoutMode={layoutMode}
                        targetLength={targetLength}
                        onGenreChange={setGenre}
                        onSynopsisChange={setSynopsis}
                        onPaperSizeChange={setPaperSize}
                        onLayoutModeChange={setLayoutMode}
                        onTargetLengthChange={setTargetLength}
                    />
                    <div className="mt-2 flex gap-1.5">
                        <button
                            type="button"
                            onClick={submitEdit}
                            disabled={name.trim() === ""}
                            className="rounded-md bg-terracotta-600 px-3 py-1 text-xs font-semibold text-white hover:bg-terracotta-700 disabled:opacity-50"
                        >
                            저장
                        </button>
                        <button
                            type="button"
                            onClick={cancelEditing}
                            className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            취소
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        startEditing();
                    }}
                    className="group/name mt-2.5 flex max-w-full self-start items-center gap-1 text-left text-base font-bold text-gray-900 hover:text-terracotta-700"
                >
                    <span className="truncate">{category.name}</span>
                    <span aria-hidden className="text-xs text-gray-300 opacity-0 group-hover/name:opacity-100">
                        ✎
                    </span>
                </button>
            )}
            {!editing && (
                <div className="mt-0.5">
                    <div className="text-xs text-gray-500">작품 {works.length}편</div>
                    {hasTarget ? (
                        <div className="mt-1">
                            <div className="text-[11px] text-gray-600">
                                {category.totalWordCount.toLocaleString()} / {target.toLocaleString()}자
                            </div>
                            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                <div
                                    className="h-full rounded-full bg-terracotta-500"
                                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="mt-1 text-[11px] text-gray-600">{category.totalWordCount.toLocaleString()}자</div>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-terracotta-700">
                        <span aria-hidden>⏱</span> 총 집필 시간 <span className="font-semibold">{formatDurationKo(category.totalDurationMs)}</span>
                    </div>
                </div>
            )}

            <button
                type="button"
                aria-label={`${category.name} 메뉴`}
                onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                }}
                className="absolute top-2 right-2 z-10 rounded-md bg-white/70 px-1.5 py-0.5 text-gray-400 hover:bg-terracotta-50 hover:text-terracotta-700"
            >
                ⋯
            </button>
            {menuOpen && (
                <div ref={menuRef} role="menu" onClick={(e) => e.stopPropagation()} className="absolute top-9 right-2 z-20 w-36 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            startEditing();
                            setMenuOpen(false);
                        }}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-terracotta-50 hover:text-terracotta-700"
                    >
                        편집
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            onDelete(category);
                            setMenuOpen(false);
                        }}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                        삭제
                    </button>
                </div>
            )}
        </div>
    );
}
