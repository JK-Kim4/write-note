"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useBoardDetail, useReferenceBoards } from "@/lib/query/useBoards";
import { getLastViewedBoard, rememberLastViewedBoard } from "@/lib/lastViewedBoard";

/**
 * 집필 중 보드 참조 패널(043, PRD §5.4 ③·§9) — 우측 슬라이드오버.
 *
 * 후보 = 그 작품 보드 + 상위 시리즈 보드(GET /boards/reference). 여러 개면 전환, 하나면 바로.
 * 마지막 본 보드를 작품별로 기억(localStorage)했다가 기본으로 연다. 보드 캔버스는 dynamic import(ssr:false)로
 * 집필 번들과 격리(PRD §9). 집필 3패널 flex 레이아웃은 건드리지 않는 overlay — 원고 옆에서 곁눈질(읽기 중심).
 */

const PlotBoardCanvas = dynamic(() => import("@/components/board/PlotBoardCanvas"), {
    ssr: false,
    loading: () => <p className="py-12 text-center text-sm text-gray-400">캔버스를 불러오는 중…</p>,
});

interface BoardReferencePanelProps {
    projectId: number;
    open: boolean;
    onClose: () => void;
}

export function BoardReferencePanel({ projectId, open, onClose }: BoardReferencePanelProps) {
    const boards = useReferenceBoards(projectId, open);
    const candidates = useMemo(() => boards.data ?? [], [boards.data]);

    // 사용자가 명시적으로 고른 보드. 미선택이면 last-viewed → 첫 후보로 파생(set-state-in-effect 회피).
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const effectiveId = useMemo(() => {
        if (candidates.length === 0) return null;
        const ids = new Set(candidates.map((b) => b.id));
        if (selectedId != null && ids.has(selectedId)) return selectedId;
        const last = getLastViewedBoard(projectId);
        if (last != null && ids.has(last)) return last;
        return candidates[0].id;
    }, [candidates, selectedId, projectId]);

    // 현재 보고 있는 보드를 기억(localStorage 쓰기 — setState 아니라 재렌더 루프 없음).
    useEffect(() => {
        if (open && effectiveId != null) rememberLastViewedBoard(projectId, effectiveId);
    }, [open, effectiveId, projectId]);

    // ESC 로 닫기.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const detail = useBoardDetail(effectiveId ?? 0, open && effectiveId != null);

    if (!open) return null;

    return (
        <aside
            role="dialog"
            aria-label="보드 참조"
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl"
        >
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-sm font-semibold text-gray-800">보드 참조</span>
                    {candidates.length > 1 && effectiveId != null && (
                        <select
                            value={effectiveId}
                            onChange={(e) => setSelectedId(Number(e.target.value))}
                            className="min-w-0 max-w-[14rem] truncate rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none"
                            aria-label="참조할 보드 선택"
                        >
                            {candidates.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name} · {b.ownerLabel}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <button
                    type="button"
                    aria-label="보드 참조 닫기"
                    onClick={onClose}
                    className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                    ✕
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
                {boards.isLoading ? (
                    <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
                ) : boards.isError ? (
                    <div className="py-12 text-center">
                        <p className="text-sm text-gray-500">참조할 보드를 불러올 수 없습니다.</p>
                        <button
                            type="button"
                            onClick={() => boards.refetch()}
                            className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                            다시 시도
                        </button>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="max-w-xs text-sm text-gray-500">
                            이 작품에 곁들일 보드가 아직 없어요. 보드를 만들어 이 작품(또는 상위 시리즈)에 붙이면 여기서
                            바로 펼쳐 볼 수 있어요.
                        </p>
                        <Link
                            href="/boards"
                            className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                        >
                            보드로 가기
                        </Link>
                    </div>
                ) : detail.isLoading ? (
                    <p className="py-12 text-center text-sm text-gray-400">보드를 여는 중…</p>
                ) : detail.isError || !detail.data || effectiveId == null ? (
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
                    <PlotBoardCanvas key={effectiveId} boardId={effectiveId} detail={detail.data} />
                )}
            </div>
        </aside>
    );
}
