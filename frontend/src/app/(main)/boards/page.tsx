"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBoardList, useCreateBoard, useDeleteBoard, useRenameBoard } from "@/lib/query/useBoards";
import { BoardMappingControl } from "@/components/board/BoardMappingControl";

/**
 * 플롯 보드 목록(038) — "보드 만들기"는 버튼 하나. 클릭 시 기본 이름으로 생성 후 캔버스로 이동하고,
 * 보드명은 캔버스 상단 제목에서 인라인 편집한다. 목록에서는 이름변경·삭제·작품/시리즈 매핑(US3).
 */
export default function BoardsPage() {
    const router = useRouter();
    const boards = useBoardList();
    const createBoard = useCreateBoard();
    const renameBoard = useRenameBoard();
    const deleteBoard = useDeleteBoard();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const handleCreate = () => {
        if (createBoard.isPending) return;
        createBoard.mutate(
            { name: "제목 없는 보드" },
            { onSuccess: (board) => router.push(`/boards/${board.id}`) },
        );
    };

    const startRename = (id: number, current: string) => {
        setEditingId(id);
        setEditName(current);
    };

    const commitRename = (id: number) => {
        const name = editName.trim();
        if (name) {
            renameBoard.mutate({ id, name });
        }
        setEditingId(null);
    };

    const list = boards.data ?? [];

    return (
        <div>
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold">플롯 보드</h1>
                <button
                    type="button"
                    onClick={handleCreate}
                    disabled={createBoard.isPending}
                    className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
                >
                    보드 만들기
                </button>
            </div>

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
                    아직 보드가 없습니다. 위 “보드 만들기”로 첫 보드를 펼쳐보세요.
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((board) => (
                        <li key={board.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
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
                            <span className="mt-1 text-xs text-gray-400">카드 {board.cardCount}개</span>

                            <BoardMappingControl
                                boardId={board.id}
                                projectId={board.projectId}
                                categoryId={board.categoryId}
                            />

                            <div className="mt-3 flex items-center gap-3 text-xs">
                                <Link href={`/boards/${board.id}`} className="font-medium text-terracotta-600 hover:text-terracotta-700">
                                    열기
                                </Link>
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
                                        if (window.confirm(`'${board.name}' 보드를 삭제할까요? 카드·연결도 함께 삭제됩니다.`)) {
                                            deleteBoard.mutate(board.id);
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    삭제
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
