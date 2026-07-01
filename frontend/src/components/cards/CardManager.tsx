"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CARD_KINDS } from "@/components/board/cardKinds";
import { useCardList, useCreateStandaloneCard, useDeleteCard } from "@/lib/query/useCards";
import type { CardItem } from "@/lib/api/cards";
import { CardTile } from "./CardTile";
import { CardDetailSheet } from "./CardDetailSheet";
import { filterCards, type CardTypeFilter, type OwnerFilter } from "./cardFilter";

const OWNER_CHIPS: { id: OwnerFilter; label: string }[] = [
    { id: "all", label: "전체" },
    { id: "board", label: "보드 소속" },
    { id: "standalone", label: "독립" },
];

/**
 * 카드 관리 화면(048, `/boards` 카드 탭) — 여러 보드 가로지르는 카드 그리드 + 검색·필터 + 독립 카드 생성 + 상세/수정/재배정/삭제.
 * 목록은 생성일 내림차순(서버), 검색·필터는 클라(정렬 불변).
 */
export function CardManager() {
    const list = useCardList();
    const createCard = useCreateStandaloneCard();
    const deleteCard = useDeleteCard();

    const [query, setQuery] = useState("");
    const [owner, setOwner] = useState<OwnerFilter>("all");
    const [typeFilter, setTypeFilter] = useState<CardTypeFilter>("all");
    const [creating, setCreating] = useState(false);
    const [createText, setCreateText] = useState("");
    const [selected, setSelected] = useState<CardItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CardItem | null>(null);

    const cards = list.data ?? [];
    const filtered = useMemo(() => filterCards(cards, { query, owner, type: typeFilter }), [cards, query, owner, typeFilter]);

    const submitCreate = () => {
        const body = createText.trim();
        if (!body || createCard.isPending) return;
        createCard.mutate(
            { body },
            {
                onSuccess: () => {
                    setCreating(false);
                    setCreateText("");
                },
            },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        deleteCard.mutate(deleteTarget.id, {
            onSuccess: () => {
                setDeleteTarget(null);
                setSelected(null);
            },
        });
    };

    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-serif text-2xl font-bold text-gray-900">카드</h2>
                    <p className="mt-1 text-[13.5px] text-gray-500">보드에 흩어진 카드와 따로 적어둔 메모를 한곳에서 관리합니다</p>
                </div>
                <button
                    type="button"
                    onClick={() => setCreating((v) => !v)}
                    className="rounded-lg bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                >
                    + 새 카드
                </button>
            </div>

            {creating && (
                <div className="mt-4 rounded-xl border border-terracotta-500 bg-white p-3.5 shadow-sm">
                    <textarea
                        autoFocus
                        value={createText}
                        onChange={(e) => setCreateText(e.target.value)}
                        placeholder="새 카드에 적을 내용을 입력하세요…"
                        className="min-h-[70px] w-full resize-y rounded-lg border border-gray-300 p-3 text-[15px] leading-relaxed focus:border-terracotta-500 focus:outline-none"
                    />
                    <div className="mt-2.5 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={submitCreate}
                            disabled={!createText.trim() || createCard.isPending}
                            className="rounded-lg bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 disabled:opacity-60"
                        >
                            저장
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreating(false);
                                setCreateText("");
                            }}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 shadow-[inset_0_0_0_1px] shadow-gray-300"
                        >
                            취소
                        </button>
                        <span className="text-[12px] text-gray-400">보드 없는 독립 카드로 만들어집니다 · 종류는 만든 뒤 지정</span>
                    </div>
                </div>
            )}

            <div className="mt-5 space-y-3">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="카드 내용 · 보드 이름으로 검색"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none sm:max-w-sm"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-[12px] font-semibold text-gray-400">소속</span>
                        {OWNER_CHIPS.map((c) => (
                            <FilterChip key={c.id} active={owner === c.id} onClick={() => setOwner(c.id)}>
                                {c.label}
                            </FilterChip>
                        ))}
                    </div>
                    <span className="hidden h-4 w-px bg-gray-200 sm:block" />
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-[12px] font-semibold text-gray-400">종류</span>
                        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
                            전체
                        </FilterChip>
                        {CARD_KINDS.map((k) => (
                            <FilterChip key={k.id} active={typeFilter === k.id} onClick={() => setTypeFilter(k.id as CardTypeFilter)}>
                                {k.label}
                            </FilterChip>
                        ))}
                        <FilterChip active={typeFilter === "untyped"} onClick={() => setTypeFilter("untyped")}>
                            무지정
                        </FilterChip>
                    </div>
                </div>
            </div>

            <div className="relative mt-5 min-h-[220px]">
                {list.isLoading ? (
                    <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
                ) : list.isError ? (
                    <div className="py-12 text-center">
                        <p className="text-sm text-gray-500">카드를 불러올 수 없습니다.</p>
                        <button
                            type="button"
                            onClick={() => list.refetch()}
                            className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : (
                    <>
                        {filtered.length > 0 && (
                            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((card) => (
                                    <CardTile key={card.id} card={card} onOpen={setSelected} />
                                ))}
                            </div>
                        )}
                        {filtered.length === 0 && (
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                                <div className="text-4xl opacity-50">🗂</div>
                                {cards.length === 0 ? (
                                    <>
                                        <p className="font-serif text-lg text-gray-700">아직 카드가 없어요</p>
                                        <p className="text-sm text-gray-500">생각나는 메모를 카드로 적어두거나, 보드에서 카드를 만들어 보세요.</p>
                                        <button
                                            type="button"
                                            onClick={() => setCreating(true)}
                                            className="pointer-events-auto rounded-lg bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                                        >
                                            + 첫 카드 만들기
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400">검색·필터에 맞는 카드가 없습니다.</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <CardDetailSheet card={selected} onClose={() => setSelected(null)} onRequestDelete={setDeleteTarget} />

            {deleteTarget && (
                <DeleteDialog
                    card={deleteTarget}
                    pending={deleteCard.isPending}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${active ? "border-terracotta-200 bg-terracotta-50 text-terracotta-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
        >
            {children}
        </button>
    );
}

function DeleteDialog({
    card,
    pending,
    onCancel,
    onConfirm,
}: {
    card: CardItem;
    pending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
            <div className="w-[400px] max-w-full rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-serif text-lg font-bold text-gray-900">이 카드를 삭제할까요?</h3>
                {card.linkCount > 0 ? (
                    <p className="mt-2.5 text-sm leading-relaxed text-gray-600">
                        이 카드는 <span className="font-bold text-red-600">{card.linkCount}개의 다른 카드</span>와 연결되어 있어요. 삭제하면 그 연결도 함께 사라집니다.
                    </p>
                ) : (
                    <p className="mt-2.5 text-sm text-gray-600">이 카드를 삭제합니다.</p>
                )}
                <p className="mt-1 text-[12px] text-gray-400">이 동작은 되돌릴 수 없습니다.</p>
                <div className="mt-5 flex justify-end gap-2.5">
                    <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 shadow-[inset_0_0_0_1px] shadow-gray-300">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={pending}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                        삭제
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
