"use client";

import { useEffect, type RefObject } from "react";

/**
 * 모달·다이얼로그 공통 접근성 훅 — ESC 닫기 + Tab focus trap + 배경 스크롤 잠금 + 닫힐 때 포커스 복귀.
 * QuickCapture 의 인라인 패턴을 재사용 가능한 형태로 추출(B 디자인 다수 모달 공유).
 *
 * - [containerRef] 모달 컨테이너. focus trap·진입 포커스의 범위.
 * - [isOpen] 열림 여부. false 면 어떤 부작용도 등록하지 않는다.
 * - [onDismiss] ESC 시 호출. 진행 중(mutation pending)이라 닫지 않으려면 호출 측이 가드해 no-op 을 넘긴다.
 */
export function useModalDismiss(
    containerRef: RefObject<HTMLElement | null>,
    isOpen: boolean,
    onDismiss: () => void,
): void {
    // 배경 스크롤 잠금 — 열려 있는 동안만, 닫히면 원복.
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    // 진입 포커스 + 닫힐 때 직전 포커스로 복귀.
    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const root = containerRef.current;
        if (root) {
            const focusable = root.querySelectorAll<HTMLElement>(
                'button:not([disabled]), textarea, input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            // autoFocus 가 이미 잡혀 있으면(컨테이너 내부면) 존중, 아니면 첫 포커스 가능 요소로.
            if (!(document.activeElement instanceof HTMLElement && root.contains(document.activeElement))) {
                focusable[0]?.focus();
            }
        }
        return () => previouslyFocused?.focus();
    }, [isOpen, containerRef]);

    // ESC 닫기 + Tab focus trap.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onDismiss();
                return;
            }
            if (e.key !== "Tab") return;
            const root = containerRef.current;
            if (!root) return;
            const items = Array.from(
                root.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), textarea, input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            );
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, containerRef, onDismiss]);
}
