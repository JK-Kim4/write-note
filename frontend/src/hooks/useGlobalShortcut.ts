"use client";

import { useEffect } from "react";

/**
 * 전역 키보드 단축키 리스너 (006 US3 T047).
 *
 * - Mac: ⌘+N / Windows·Linux: Ctrl+N
 * - `textarea`, `input`, `[contenteditable]` 포커스 중엔 단축키 무시 (기본 텍스트 입력 보호)
 * - 단축키 fire 시 `onTrigger` 콜백 호출
 * - cleanup: useEffect return 으로 리스너 제거
 *
 * 사용처: 인증된 화면 루트에서 마운트 (Providers 혹은 shell 레벨).
 */

const EDITING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const isEditingContext = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    if (EDITING_TAGS.has(target.tagName)) return true;
    if (target.getAttribute("contenteditable") === "true") return true;
    return false;
};

export function useGlobalShortcut(onTrigger: () => void): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            const isMeta = e.metaKey || e.ctrlKey;
            if (!isMeta || e.key !== "n") return;
            if (isEditingContext(e.target)) return;
            e.preventDefault();
            onTrigger();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onTrigger]);
}
