"use client";

/**
 * ChapterList (022 US1 T014, US2 T022, US3 T030) — A·B 공용 챕터 목록 presentational 컴포넌트.
 *
 * props:
 *  - chapters: 챕터 메타 배열 (sortOrder 순, 호출자가 정렬·로드 담당)
 *  - currentChapterId: 현재 편집 중인 챕터 ID (없으면 null)
 *  - onSelect(id): 챕터 선택 콜백
 *  - onCreate(): "새 챕터" 버튼 콜백
 *  - onMove(id, direction): 위/아래 순서 이동 콜백 (optional — 미전달 시 버튼 숨김)
 *  - onDelete(id): 챕터 삭제 콜백 (optional — 미전달 시 삭제 버튼 숨김)
 *    챕터가 1개일 때 삭제 버튼 disabled (INV-1 1차 방어 — 마지막 챕터 불변식).
 *  - onRename(id, title): 챕터 제목 편집 콜백 (optional — 미전달 시 더블클릭 편집 비활성)
 *
 * 순수 표시 컴포넌트 — 데이터 fetch 금지. 'use client' 필수(onClick 핸들러).
 */

import { useCallback, useRef, useState } from "react";
import type { ChapterMeta } from "@/lib/types/domain";

export type MoveDirection = "up" | "down";

export type ChapterListProps = {
    chapters: ChapterMeta[];
    currentChapterId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
    onMove?: (id: number, direction: MoveDirection) => void;
    /** 챕터 삭제 콜백. 미전달 시 삭제 버튼 숨김. */
    onDelete?: (id: number) => void;
    /** 챕터 제목 편집 콜백. 미전달 시 더블클릭 인라인 편집 비활성. */
    onRename?: (id: number, title: string) => void;
};

/** 챕터 항목 — 인라인 편집 상태를 지역적으로 관리. */
function ChapterItem({
    chapter,
    isCurrent,
    isFirst,
    isLast,
    canDelete,
    showMoveButtons,
    showDeleteButtons,
    showRename,
    onSelect,
    onMove,
    onDelete,
    onRename,
}: {
    chapter: ChapterMeta;
    isCurrent: boolean;
    isFirst: boolean;
    isLast: boolean;
    canDelete: boolean;
    showMoveButtons: boolean;
    showDeleteButtons: boolean;
    showRename: boolean;
    onSelect: (id: number) => void;
    onMove?: (id: number, direction: MoveDirection) => void;
    onDelete?: (id: number) => void;
    onRename?: (id: number, title: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    // blur 중 Enter/Escape 로 이미 처리된 경우 blur 핸들러가 중복 호출하지 않도록 방어
    const committedRef = useRef(false);

    const startEdit = useCallback(() => {
        if (!showRename) return;
        setEditValue(chapter.title || "");
        setEditing(true);
        committedRef.current = false;
        // 다음 tick 에 포커스
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [showRename, chapter.title]);

    const commit = useCallback(() => {
        if (committedRef.current) return;
        committedRef.current = true;
        onRename?.(chapter.id, editValue);
        setEditing(false);
    }, [chapter.id, editValue, onRename]);

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

    return (
        <div className="chapter-list__item-row">
            {editing ? (
                <input
                    ref={inputRef}
                    type="text"
                    className="chapter-list__rename-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commit}
                    aria-label={`${chapter.title} 제목 편집`}
                />
            ) : (
                <button
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => onSelect(chapter.id)}
                    onDoubleClick={startEdit}
                    className={`chapter-list__item${isCurrent ? " chapter-list__item--current" : ""}`}
                >
                    {chapter.title || "(제목 없음)"}
                </button>
            )}
            {showMoveButtons && (
                <div className="chapter-list__move-buttons">
                    {!isFirst && (
                        <button
                            type="button"
                            aria-label={`${chapter.title} 위로`}
                            onClick={() => onMove?.(chapter.id, "up")}
                            className="chapter-list__move chapter-list__move--up"
                        >
                            ▲
                        </button>
                    )}
                    {!isLast && (
                        <button
                            type="button"
                            aria-label={`${chapter.title} 아래로`}
                            onClick={() => onMove?.(chapter.id, "down")}
                            className="chapter-list__move chapter-list__move--down"
                        >
                            ▼
                        </button>
                    )}
                </div>
            )}
            {showDeleteButtons && (
                <button
                    type="button"
                    aria-label={`${chapter.title} 챕터 삭제`}
                    disabled={!canDelete}
                    onClick={() => onDelete?.(chapter.id)}
                    className="chapter-list__delete"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export function ChapterList({ chapters, currentChapterId, onSelect, onCreate, onMove, onDelete, onRename }: ChapterListProps) {
    const showMoveButtons = onMove != null;
    const showDeleteButtons = onDelete != null;
    const showRename = onRename != null;
    /** 마지막 챕터 불변식(INV-1) 1차 방어 — 활성 챕터 1개일 때 삭제 버튼 disabled. */
    const canDelete = chapters.length > 1;

    return (
        <div className="chapter-list">
            <div className="chapter-list__items">
                {chapters.map((chapter, index) => {
                    const isCurrent = chapter.id === currentChapterId;
                    const isFirst = index === 0;
                    const isLast = index === chapters.length - 1;
                    return (
                        <ChapterItem
                            key={chapter.id}
                            chapter={chapter}
                            isCurrent={isCurrent}
                            isFirst={isFirst}
                            isLast={isLast}
                            canDelete={canDelete}
                            showMoveButtons={showMoveButtons}
                            showDeleteButtons={showDeleteButtons}
                            showRename={showRename}
                            onSelect={onSelect}
                            onMove={onMove}
                            onDelete={onDelete}
                            onRename={onRename}
                        />
                    );
                })}
            </div>
            <button type="button" onClick={onCreate} className="chapter-list__create">
                + 새 챕터
            </button>
        </div>
    );
}
