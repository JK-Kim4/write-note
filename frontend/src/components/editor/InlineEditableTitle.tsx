"use client";

import { useCallback, useRef, useState } from "react";

/**
 * InlineEditableTitle — 더블클릭으로 인라인 편집 가능한 제목 컴포넌트.
 *
 * ChapterList 의 인라인 편집 정책을 동일하게 적용:
 * - 더블클릭 → input(초기값 기존 제목) → Enter/blur 저장 · Escape 취소
 * - committedRef 로 Enter 후 blur 중복 방어
 * - 빈/공백 제목은 저장 생략 (@NotBlank guard)
 * - 무변경이면 저장 생략 (불필요한 PATCH 방지)
 *
 * A형(PaperEditor)·B형(BEditor) 본문 상단 챕터 제목에 공용.
 */

type InlineEditableTitleProps = {
    /** 현재 제목 — 표시 및 편집 초기값. 빈 문자열이면 placeholder 표시. */
    title: string;
    /** 편집 완료 후 저장 콜백. trim 된 제목이 전달됨. 미전달 시 편집 비활성. */
    onRename?: (title: string) => void;
    /** title 이 빈 문자열일 때 표시할 placeholder 텍스트. */
    placeholder?: string;
    /** 표시 영역 className — 외부에서 스타일 제어. */
    className?: string;
    /** input 의 aria-label. */
    ariaLabel?: string;
};

export function InlineEditableTitle({ title, onRename, placeholder = "새 챕터", className, ariaLabel = "챕터 제목 편집" }: InlineEditableTitleProps) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    // blur 중 Enter/Escape 로 이미 처리된 경우 blur 핸들러가 중복 호출하지 않도록 방어
    const committedRef = useRef(false);

    const startEdit = useCallback(() => {
        if (!onRename) return;
        setEditValue(title);
        setEditing(true);
        committedRef.current = false;
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [onRename, title]);

    const commit = useCallback(() => {
        if (committedRef.current) return;
        committedRef.current = true;
        const trimmed = editValue.trim();
        if (trimmed.length > 0 && trimmed !== title) {
            onRename?.(trimmed);
        }
        setEditing(false);
    }, [editValue, title, onRename]);

    const cancel = useCallback(() => {
        if (committedRef.current) return;
        committedRef.current = true;
        setEditing(false);
    }, []);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
            }
        },
        [commit, cancel],
    );

    if (editing) {
        return (
            <input
                ref={inputRef}
                type="text"
                className={className}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={commit}
                aria-label={ariaLabel}
            />
        );
    }

    return (
        <span
            className={className}
            onDoubleClick={startEdit}
            role={onRename != null ? "button" : undefined}
            tabIndex={onRename != null ? 0 : undefined}
            aria-label={onRename != null ? ariaLabel : undefined}
        >
            {title || placeholder}
        </span>
    );
}
