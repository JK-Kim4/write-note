"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardList, useCreateBoard } from "@/lib/query/useBoards";
import type { BoardOwnerType, BoardSummary } from "@/lib/api/boards";

/**
 * 내부 탭(042, PRD §5.4 ②) — 특정 작품/시리즈에 매달린 보드만 보이는 인라인 목록 + 이름만 생성 + 열기.
 *
 * 전역 허브(/boards)와 달리 owner 가 맥락으로 고정돼 있어 picker 없이 이름만 받아 생성한다(UX TASK-4 "내부
 * 생성 = owner 자동, 이름만"). 이름변경/삭제/소속변경은 전역 허브가 담당(중복 회피) — 여기선 목록·생성·열기만.
 *
 * - `InlineBoardListView` = 순수 표시(테스트 대상): 목록/빈상태/로딩/에러 + 인라인 생성 폼.
 * - `InlineBoardList` = 컨테이너: owner 스코프 훅(useBoardList/useCreateBoard) + 라우팅 배선.
 */

const COPY = {
    newButton: "+ 새 보드",
    namePlaceholder: "보드 이름 (예: 인물 관계, 1부 사건 흐름)",
    create: "만들기",
    cancel: "취소",
    open: "열기",
    loading: "불러오는 중…",
    loadError: "보드를 불러올 수 없습니다.",
    retry: "다시 시도",
} as const;

export interface InlineBoardListViewProps {
    boards: BoardSummary[];
    isLoading: boolean;
    isError: boolean;
    /** 빈 상태 안내 문구(작품/시리즈별로 주체를 끼워 넣는다). */
    emptyHint: string;
    creating: boolean;
    onOpen: (boardId: number) => void;
    onCreate: (name: string) => void;
    onRetry: () => void;
}

/** 순수 표시 — 목록 + 인라인 생성 폼. 생성 폼 토글·입력값은 로컬 UI 상태. */
export function InlineBoardListView({
    boards,
    isLoading,
    isError,
    emptyHint,
    creating,
    onOpen,
    onCreate,
    onRetry,
}: InlineBoardListViewProps) {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState("");

    const submit = () => {
        const name = draft.trim();
        if (!name || creating) return;
        onCreate(name);
        setDraft("");
        setAdding(false);
    };

    return (
        <div className="flex flex-col gap-2">
            {isLoading ? (
                <p className="px-1 py-2 text-xs text-faint">{COPY.loading}</p>
            ) : isError ? (
                <div className="px-1 py-2">
                    <p className="text-xs text-muted">{COPY.loadError}</p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-1.5 rounded-md border border-border-strong px-2 py-1 text-xs text-muted-strong hover:bg-surface-2"
                    >
                        {COPY.retry}
                    </button>
                </div>
            ) : boards.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-strong px-3 py-3 text-center text-xs text-faint">
                    {emptyHint}
                </p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {boards.map((board) => (
                        <li key={board.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(board.id)}
                                className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-terracotta-300 hover:bg-terracotta-50"
                            >
                                <span className="truncate text-sm font-medium text-ink">{board.name}</span>
                                <span className="shrink-0 text-xs text-faint">카드 {board.cardCount}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {adding ? (
                <div className="flex flex-col gap-1.5">
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") submit();
                            if (e.key === "Escape") {
                                setDraft("");
                                setAdding(false);
                            }
                        }}
                        placeholder={COPY.namePlaceholder}
                        maxLength={120}
                        aria-label="새 보드 이름"
                        className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm focus:border-terracotta-500 focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={draft.trim().length === 0 || creating}
                            className="rounded-md bg-terracotta-600 px-3 py-1 text-xs font-semibold text-white hover:bg-terracotta-700 disabled:opacity-50"
                        >
                            {COPY.create}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setDraft("");
                                setAdding(false);
                            }}
                            className="rounded-md border border-border px-3 py-1 text-xs text-muted-strong hover:bg-surface-2"
                        >
                            {COPY.cancel}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="rounded-md border border-dashed border-border-strong px-3 py-1.5 text-sm text-muted hover:border-terracotta-400 hover:text-terracotta-600"
                >
                    {COPY.newButton}
                </button>
            )}
        </div>
    );
}

export interface InlineBoardListProps {
    ownerType: BoardOwnerType;
    ownerId: number;
    /** 빈 상태 안내(예: "아직 이 작품 보드가 없어요."). */
    emptyHint: string;
    /**
     * 보드 열기 동작(046) — 전달 시 보드 페이지로 이동하는 대신 이 콜백으로 연다(집필 화면 인라인 오버레이).
     * 미전달 시 기존대로 `/boards/{id}` 로 이동(라이브러리 시리즈 보드 섹션 등). 생성 성공 시에도 동일 적용.
     */
    onOpenBoard?: (boardId: number) => void;
}

/** 컨테이너 — owner 스코프 목록·생성·열기 배선. 생성 성공 시 그 보드로 이동(또는 onOpenBoard). */
export function InlineBoardList({ ownerType, ownerId, emptyHint, onOpenBoard }: InlineBoardListProps) {
    const router = useRouter();
    const boards = useBoardList({ ownerType, ownerId });
    const createBoard = useCreateBoard();

    const openBoard = (boardId: number) => {
        if (onOpenBoard) onOpenBoard(boardId);
        else router.push(`/boards/${boardId}`);
    };

    const handleCreate = (name: string) => {
        if (createBoard.isPending) return;
        createBoard.mutate({ name, ownerType, ownerId }, { onSuccess: (board) => openBoard(board.id) });
    };

    return (
        <InlineBoardListView
            boards={boards.data ?? []}
            isLoading={boards.isLoading}
            isError={boards.isError}
            emptyHint={emptyHint}
            creating={createBoard.isPending}
            onOpen={openBoard}
            onCreate={handleCreate}
            onRetry={() => boards.refetch()}
        />
    );
}
