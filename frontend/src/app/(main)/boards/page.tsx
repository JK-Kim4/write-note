"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useBoardsMine,
    useCreateBoard,
    useDeleteBoard,
    usePatchBoardOwner,
    useRenameBoard,
} from "@/lib/query/useBoards";
import type { BoardSummary } from "@/lib/api/boards";
import { BoardOwnerPicker, type BoardOwnerResult } from "@/components/board/BoardOwnerPicker";
import { CardManager } from "@/components/cards/CardManager";

const COPY = {
    newButton: "+ 새 보드",
    searchPlaceholder: "작품·시리즈·보드 이름으로 검색",
    attachAction: "작품/시리즈에 연결",
    changeAction: "소속 변경",
    labelIdea: "아이디어",
} as const;

type Picker = { mode: "create" } | { mode: "owner"; board: BoardSummary } | null;

/**
 * 전역 보드 허브(041) — 내 모든 보드를 소속 라벨과 함께 최근순으로. 작품·시리즈·보드명 검색(클라 필터),
 * 생성 picker("이 보드는 어디에 쓸 건가요?"), 아이디어 보드 "작품/시리즈에 연결"·소속 변경.
 */
export default function BoardsPage() {
    const router = useRouter();
    const boards = useBoardsMine();
    const createBoard = useCreateBoard();
    const renameBoard = useRenameBoard();
    const deleteBoard = useDeleteBoard();
    const patchOwner = usePatchBoardOwner();

    const [tab, setTab] = useState<"boards" | "cards">("boards");
    const [picker, setPicker] = useState<Picker>(null);
    const [query, setQuery] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const list = boards.data ?? [];
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (b) => b.name.toLowerCase().includes(q) || b.ownerLabel.toLowerCase().includes(q),
        );
    }, [list, query]);

    const startRename = (id: number, current: string) => {
        setEditingId(id);
        setEditName(current);
    };
    const commitRename = (id: number) => {
        const name = editName.trim();
        if (name) renameBoard.mutate({ id, name });
        setEditingId(null);
    };

    const handleCreate = (result: BoardOwnerResult) => {
        if (createBoard.isPending) return;
        createBoard.mutate(
            { name: result.name ?? "제목 없는 보드", ownerType: result.ownerType, ownerId: result.ownerId },
            {
                onSuccess: (board) => {
                    setPicker(null);
                    router.push(`/boards/${board.id}`);
                },
            },
        );
    };

    const handleSetOwner = (boardId: number, result: BoardOwnerResult) => {
        patchOwner.mutate(
            { id: boardId, ownerType: result.ownerType, ownerId: result.ownerId },
            { onSuccess: () => setPicker(null) },
        );
    };

    return (
        <div>
            <div className="mb-5 flex gap-5 border-b border-gray-200">
                {(["boards", "cards"] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`-mb-px border-b-2 px-1 py-2.5 text-[15px] font-semibold ${
                            tab === t
                                ? "border-terracotta-500 text-terracotta-700"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {t === "boards" ? "보드" : "카드"}
                    </button>
                ))}
            </div>

            {tab === "cards" && <CardManager />}

            {tab === "boards" && (
                <>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold">플롯 보드</h1>
                <button
                    type="button"
                    onClick={() => setPicker({ mode: "create" })}
                    className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                >
                    {COPY.newButton}
                </button>
            </div>

            {list.length > 0 && (
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={COPY.searchPlaceholder}
                    className="mb-5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none sm:max-w-sm"
                />
            )}

            {boards.isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : boards.isError ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">보드를 불러올 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => boards.refetch()}
                        className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        다시 시도
                    </button>
                </div>
            ) : list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">
                    아직 보드가 없습니다. 위 “{COPY.newButton}”로 첫 보드를 펼쳐보세요.
                </p>
            ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">검색 결과가 없습니다.</p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((board) => {
                        const isIdea = board.ownerType == null;
                        const chip =
                            board.ownerType === "project"
                                ? { text: `작품 · ${board.ownerLabel}`, cls: "bg-terracotta-50 text-terracotta-700" }
                                : board.ownerType === "category"
                                  ? { text: `시리즈 · ${board.ownerLabel}`, cls: "bg-teal-50 text-teal-700" }
                                  : { text: board.ownerLabel, cls: "bg-gray-100 text-gray-500" };
                        return (
                            <li
                                key={board.id}
                                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4"
                            >
                                {editingId === board.id ? (
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={() => commitRename(board.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") commitRename(board.id);
                                            if (e.key === "Escape") setEditingId(null);
                                        }}
                                        className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none"
                                    />
                                ) : (
                                    <Link
                                        href={`/boards/${board.id}`}
                                        className="text-base font-semibold text-gray-900 hover:text-terracotta-700"
                                    >
                                        {board.name}
                                    </Link>
                                )}

                                <div className="mt-2 flex items-center gap-2">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}
                                    >
                                        {chip.text}
                                    </span>
                                    <span className="text-xs text-gray-400">카드 {board.cardCount}개</span>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                                    <Link
                                        href={`/boards/${board.id}`}
                                        className="font-medium text-terracotta-600 hover:text-terracotta-700"
                                    >
                                        열기
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setPicker({ mode: "owner", board })}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        {isIdea ? COPY.attachAction : COPY.changeAction}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => startRename(board.id, board.name)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        이름변경
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `'${board.name}' 보드를 삭제할까요? 카드·연결도 함께 삭제됩니다.`,
                                                )
                                            ) {
                                                deleteBoard.mutate(board.id);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {picker?.mode === "create" && (
                <BoardOwnerPicker
                    title="새 보드"
                    withName
                    confirmLabel="만들기"
                    pending={createBoard.isPending}
                    onConfirm={handleCreate}
                    onCancel={() => setPicker(null)}
                />
            )}
            {picker?.mode === "owner" && (
                <BoardOwnerPicker
                    title={picker.board.ownerType == null ? COPY.attachAction : COPY.changeAction}
                    withName={false}
                    initialKind={
                        picker.board.ownerType === "project"
                            ? "work"
                            : picker.board.ownerType === "category"
                              ? "series"
                              : "idea"
                    }
                    initialOwnerId={picker.board.ownerId}
                    confirmLabel="저장"
                    pending={patchOwner.isPending}
                    onConfirm={(result) => handleSetOwner(picker.board.id, result)}
                    onCancel={() => setPicker(null)}
                />
            )}
                </>
            )}
        </div>
    );
}
