"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useBoardDetail, useRenameBoard } from "@/lib/query/useBoards";

/**
 * 플롯 보드 캔버스 페이지(038) — 상세 하이드레이션 후 클라이언트 전용 캔버스를 dynamic(ssr:false) 로드.
 * 보드명은 상단 제목을 클릭해 인라인 편집(생성은 목록의 "보드 만들기"가 기본 이름으로 만들어 이리로 보냄).
 */

const PlotBoardCanvas = dynamic(() => import("@/components/board/PlotBoardCanvas"), {
    ssr: false,
    loading: () => <p className="py-12 text-center text-sm text-gray-400">캔버스를 불러오는 중…</p>,
});

export default function BoardCanvasPage() {
    const params = useParams<{ boardId: string }>();
    const boardId = Number(params.boardId);
    const valid = Number.isFinite(boardId) && boardId > 0;
    const detail = useBoardDetail(boardId, valid);
    const renameBoard = useRenameBoard();

    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState("");

    const name = detail.data?.board.name ?? "";

    const startEdit = () => {
        setTitleDraft(name);
        setEditingTitle(true);
    };

    const commitTitle = () => {
        setEditingTitle(false);
        const next = titleDraft.trim();
        if (next && next !== name) {
            renameBoard.mutate({ id: boardId, name: next });
        }
    };

    return (
        <div>
            <div className="mb-4 flex items-center gap-3">
                <Link href="/boards" className="shrink-0 text-sm text-gray-500 hover:text-gray-700">
                    ← 보드 목록
                </Link>
                {detail.data &&
                    (editingTitle ? (
                        <input
                            autoFocus
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitTitle();
                                if (e.key === "Escape") setEditingTitle(false);
                            }}
                            className="rounded-md border border-gray-300 px-2 py-1 text-lg font-semibold focus:border-terracotta-500 focus:outline-none"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={startEdit}
                            title="클릭해 보드 이름 변경"
                            className="rounded px-1 text-lg font-semibold text-gray-900 hover:bg-gray-100 hover:text-terracotta-700"
                        >
                            {name}
                        </button>
                    ))}
            </div>

            {!valid ? (
                <p className="py-12 text-center text-sm text-gray-500">잘못된 보드입니다.</p>
            ) : detail.isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : detail.isError || !detail.data ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">보드를 불러올 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => detail.refetch()}
                        className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <PlotBoardCanvas key={boardId} boardId={boardId} detail={detail.data} />
            )}
        </div>
    );
}
