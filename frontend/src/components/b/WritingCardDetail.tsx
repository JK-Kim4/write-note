"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { kindOf } from "@/components/board/cardKinds";
import { useModalDismiss } from "@/lib/useModalDismiss";
import type { CardItem } from "@/lib/api/cards";

/**
 * 집필 카드 뷰(048 US6)의 **읽기 전용** 카드 상세 — 중앙 미니 오버레이(portal).
 *
 * 참조 목적(열람)만 — 편집·재배정·삭제는 `/boards` 카드 탭(CardDetailSheet)의 몫이라 여기엔 두지 않는다
 * (목업 `2026-07-01-writing-card-view-mockup.html` 확정 + research D9, rule-28 화해). 우측 슬라이드오버가 이미
 * 보드 참조 패널이라 두 번째 슬라이드오버 대신 중앙 오버레이로 겹침을 피한다. portal(document.body)로 패널
 * stacking 밖에 얹어 패널(z-40)/캐처(z-30) 위에 뜬다(code-quality §stacking).
 */
export function WritingCardDetail({ card, onClose }: { card: CardItem | null; onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // 닫힘 페이드 동안 마지막 카드를 유지(빈 오버레이 깜빡임 방지).
    const [shown, setShown] = useState<CardItem | null>(null);
    useEffect(() => {
        if (card) setShown(card);
    }, [card]);

    const cardRef = useRef<HTMLDivElement | null>(null);
    useModalDismiss(cardRef, card != null, onClose);

    if (!mounted) return null;

    const open = card != null;
    const detail = shown;
    const kind = detail ? kindOf(detail.type) : null;

    return createPortal(
        // 닫힘 페이드 동안 마지막 카드를 DOM 에 남기되(부드러운 close), inert 로 탭 순서·접근성 트리에서 빼
        // 닫힌 다이얼로그가 키보드·스크린리더에 잡히지 않게 한다(pointer-events-none 만으론 키보드가 새 감).
        <div
            inert={!open}
            className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-4 transition-opacity ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={onClose}
        >
            {detail && kind && (
                <div
                    ref={cardRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="카드 내용"
                    className={`w-[340px] max-w-[90%] overflow-hidden rounded-2xl bg-white shadow-2xl transition-transform ${
                        open ? "scale-100" : "scale-95"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${kind.chip}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${kind.dot}`} />
                            {kind.label}
                        </span>
                        <button
                            type="button"
                            aria-label="닫기"
                            onClick={onClose}
                            className="rounded px-2 py-1 text-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="px-4 pb-1 pt-3">
                        <div className="text-[12px]">
                            {detail.boardId == null ? (
                                <span className="italic text-gray-400">🗂 속한 보드 없음</span>
                            ) : (
                                <span className="text-gray-500">🕸 {detail.boardName}</span>
                            )}
                        </div>
                        <p className="mt-2.5 max-h-[42vh] overflow-y-auto whitespace-pre-wrap text-[15px] leading-relaxed text-gray-900">
                            {detail.body.trim() ? detail.body : <span className="text-gray-400">(내용 없음)</span>}
                        </p>
                    </div>
                    <p className="px-4 pb-3.5 pt-2 text-[11px] text-gray-400">
                        집필 중 참조용 — 편집·생성·재배정은 보드 화면의 카드 탭에서
                    </p>
                </div>
            )}
        </div>,
        document.body,
    );
}
