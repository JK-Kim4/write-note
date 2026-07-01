"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CARD_KINDS } from "@/components/board/cardKinds";
import { ApiError } from "@/lib/api/client";
import { useModalDismiss } from "@/lib/useModalDismiss";
import { useBoardsMine } from "@/lib/query/useBoards";
import { useEditCard, useSetCardBoard } from "@/lib/query/useCards";
import type { CardItem } from "@/lib/api/cards";

/**
 * 카드 상세 슬라이드오버(우측, portal) — 종류 변경·본문 수정(US3) + 소속 보드 재배정(US5, 연결 있으면 잠금) + 삭제 트리거(US4).
 * 삭제 경고 다이얼로그는 부모(CardManager)가 [onRequestDelete] 로 띄운다.
 */
export function CardDetailSheet({
    card,
    onClose,
    onRequestDelete,
}: {
    card: CardItem | null;
    onClose: () => void;
    onRequestDelete: (card: CardItem) => void;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // 닫힘 슬라이드 동안 내용을 유지하려고 마지막 카드를 보관.
    const [shown, setShown] = useState<CardItem | null>(null);
    const [body, setBody] = useState("");
    const [type, setType] = useState<string | null>(null);
    const [boardValue, setBoardValue] = useState("");
    const sheetRef = useRef<HTMLElement | null>(null);

    const boards = useBoardsMine();
    const editCard = useEditCard();
    const setCardBoard = useSetCardBoard();

    useEffect(() => {
        if (card) {
            setShown(card);
            setBody(card.body);
            setType(card.type);
            setBoardValue(card.boardId != null ? String(card.boardId) : "");
        }
    }, [card]);

    // 공통 모달 훅 — ESC 닫기 + Tab focus trap + 배경 스크롤 잠금 + 포커스 복귀.
    useModalDismiss(sheetRef, card != null, onClose);

    if (!mounted) return null;

    const open = card != null;
    const detail = shown;
    const locked = (detail?.linkCount ?? 0) > 0;

    const handleSave = () => {
        if (!detail) return;
        editCard.mutate({ cardId: detail.id, input: { body, type } }, { onSuccess: onClose });
    };

    const handleReassign = (value: string) => {
        if (!detail) return;
        const previous = boardValue;
        setBoardValue(value);
        setCardBoard.mutate(
            { cardId: detail.id, boardId: value === "" ? null : Number(value) },
            {
                onError: (err) => {
                    setBoardValue(previous);
                    window.alert(err instanceof ApiError ? err.message : "소속 보드를 바꿀 수 없습니다.");
                },
            },
        );
    };

    return createPortal(
        <>
            <div
                className={`fixed inset-0 z-40 bg-black/20 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
                onClick={onClose}
            />
            <aside
                ref={sheetRef}
                className={`fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-[92%] flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <span className="text-[13px] font-bold text-gray-500">카드 상세</span>
                    <button type="button" onClick={onClose} className="rounded px-2 py-1 text-lg text-gray-400 hover:bg-gray-100">
                        ✕
                    </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-5">
                    <div>
                        <div className="mb-2 text-[12px] font-bold text-gray-500">내용</div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="min-h-[130px] w-full resize-y rounded-lg border border-gray-300 p-3 text-[15px] leading-relaxed text-gray-900 focus:border-terracotta-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <div className="mb-2 text-[12px] font-bold text-gray-500">종류</div>
                        <div className="flex flex-wrap gap-2">
                            {CARD_KINDS.map((k) => (
                                <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => setType(k.id)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${k.bg} ${k.border} ${k.chip} ${type === k.id ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                                >
                                    <span className={`h-2 w-2 rounded-full ${k.dot}`} />
                                    {k.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setType(null)}
                                className={`inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-500 ${type == null ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                            >
                                종류 없음
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 text-[12px] font-bold text-gray-500">소속 보드</div>
                        <select
                            value={boardValue}
                            disabled={locked}
                            onChange={(e) => handleReassign(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 focus:border-terracotta-500 focus:outline-none"
                        >
                            <option value="">— 속한 보드 없음 (독립) —</option>
                            {(boards.data ?? []).map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        {locked ? (
                            <p className="mt-2 flex gap-2 rounded-lg border border-terracotta-200 bg-terracotta-50 px-3 py-2 text-[12.5px] text-terracotta-700">
                                <span>🔒</span>
                                <span>다른 카드와 연결되어 있어 소속 보드를 바꿀 수 없어요. 보드 화면에서 연결을 정리한 뒤 옮겨주세요.</span>
                            </p>
                        ) : (
                            <p className="mt-1.5 text-[12px] text-gray-400">붙이기 · 떼기 · 다른 보드로 옮기기</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2.5 border-t border-gray-200 px-5 py-3.5">
                    <button
                        type="button"
                        onClick={() => detail && onRequestDelete(detail)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 shadow-[inset_0_0_0_1px] shadow-red-200 hover:bg-red-50"
                    >
                        삭제
                    </button>
                    <span className="flex-1" />
                    <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 shadow-[inset_0_0_0_1px] shadow-gray-300">
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={editCard.isPending}
                        className="rounded-lg bg-terracotta-600 px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-700 disabled:opacity-60"
                    >
                        저장
                    </button>
                </div>
            </aside>
        </>,
        document.body,
    );
}
