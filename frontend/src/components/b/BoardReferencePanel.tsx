"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useBoardDetail, useReferenceBoards } from "@/lib/query/useBoards";
import { getLastViewedBoard, rememberLastViewedBoard } from "@/lib/lastViewedBoard";
import { WritingCardView } from "@/components/b/WritingCardView";
import { WritingCardDetail } from "@/components/b/WritingCardDetail";
import type { CardItem } from "@/lib/api/cards";

/**
 * 집필 중 보드 참조 패널(043 → 046 인라인 편집 다듬기, PRD §5.4 ③·§9) — 우측 슬라이드오버.
 *
 * 후보 = 그 작품 보드 + 상위 시리즈 보드(GET /boards/reference). 여러 개면 전환, 하나면 바로.
 * 마지막 본 보드를 작품별로 기억(localStorage)했다가 기본으로 연다. 보드 캔버스는 dynamic import(ssr:false)로
 * 집필 번들과 격리(PRD §9). 집필 3패널 flex 레이아웃은 건드리지 않는 overlay.
 *
 * 046: 보드 페이지로 완전 이탈하던 진입을 여기로 통일(집필 화면 유지). 열고/닫기 UX 다듬음 —
 *  - 슬라이드 인/아웃(transform transition, 닫힐 때 콘텐츠를 잠깐 유지해 빈 패널 슬라이드 방지)
 *  - 닫기 3경로: ✕ · ESC · 원고(바깥) 클릭(투명 캐처 — 원고 안 어두워짐)
 *  - initialBoardId 로 특정 보드 preselect(사이드 목록 클릭 진입)
 *  - ⤢ 넓게(폭 토글) · ↗ 전체 화면(보드 페이지로 진짜 이동)
 *
 * 048 US6: 헤더에 [보드 | 카드] 토글을 더한다. [카드] 뷰(WritingCardView)는 그 작품 관련 보드 카드 + 독립 카드를
 * 3단 그룹으로 모아 읽기 전용으로 참조(WritingCardDetail). 관리(생성·재배정·삭제)는 /boards 카드 탭의 몫.
 */

const PlotBoardCanvas = dynamic(() => import("@/components/board/PlotBoardCanvas"), {
    ssr: false,
    loading: () => <p className="py-12 text-center text-sm text-gray-400">캔버스를 불러오는 중…</p>,
});

const REF_VIEWS = [
    { key: "board", label: "보드", icon: "🕸" },
    { key: "card", label: "카드", icon: "🗂" },
] as const satisfies ReadonlyArray<{ key: "board" | "card"; label: string; icon: string }>;

interface BoardReferencePanelProps {
    projectId: number;
    open: boolean;
    onClose: () => void;
    /** 046: 특정 보드로 열기(사이드 목록 클릭). null/미지정이면 마지막 본 보드 → 첫 후보. */
    initialBoardId?: number | null;
}

/**
 * 보드 본문(상세 + 캔버스) — **열림에 따라 마운트/언마운트되는 자식**.
 * 부모 최상단에서 useBoardDetail 을 호출하면 패널이 늘 마운트돼 있어 같은 보드를 닫았다 다시 열 때
 * observer 가 remount 되지 않아 `refetchOnMount:"always"` 가 재발동하지 않고 stale 캐시로 재시드된다
 * (= 오버레이에서 편집 → 닫기 → 재오픈 시 편집 유실). 본문을 자식으로 분리해 재오픈마다 fresh mount →
 * 서버 최신 재하이드레이션(편집 반영). 보드 전환(key 변경)에도 동일하게 fresh.
 */
function BoardReferenceCanvas({ boardId }: { boardId: number }) {
    const detail = useBoardDetail(boardId, true);
    if (detail.isLoading) {
        return <p className="py-12 text-center text-sm text-gray-400">보드를 여는 중…</p>;
    }
    if (detail.isError || !detail.data) {
        return (
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
        );
    }
    return <PlotBoardCanvas key={boardId} boardId={boardId} detail={detail.data} />;
}

export function BoardReferencePanel({ projectId, open, onClose, initialBoardId }: BoardReferencePanelProps) {
    const router = useRouter();
    const boards = useReferenceBoards(projectId, open);
    const candidates = useMemo(() => boards.data ?? [], [boards.data]);

    // 사용자가 명시적으로 고른 보드. 미선택이면 last-viewed → 첫 후보로 파생(set-state-in-effect 회피).
    const [selectedId, setSelectedId] = useState<number | null>(null);
    // 폭 넓게 토글(046). 닫히면 초기화.
    const [wide, setWide] = useState(false);
    // 슬라이드-아웃 동안 콘텐츠를 잠깐 유지(빈 패널이 미끄러지는 것 방지).
    const [mounted, setMounted] = useState(open);
    // 048 US6: [보드 | 카드] 뷰 토글 + 읽기 전용 카드 상세.
    const [view, setView] = useState<"board" | "card">("board");
    const [detailCard, setDetailCard] = useState<CardItem | null>(null);
    // 카드 상세가 열려 있으면 패널 ESC 는 양보(상세만 닫힘) — deps 안정 위해 ref 로 읽는다.
    const detailOpenRef = useRef(false);
    useEffect(() => {
        detailOpenRef.current = detailCard != null;
    }, [detailCard]);

    const effectiveId = useMemo(() => {
        if (candidates.length === 0) return null;
        const ids = new Set(candidates.map((b) => b.id));
        if (selectedId != null && ids.has(selectedId)) return selectedId;
        const last = getLastViewedBoard(projectId);
        if (last != null && ids.has(last)) return last;
        return candidates[0].id;
    }, [candidates, selectedId, projectId]);

    // 046: 특정 보드로 열면 그 보드를 preselect(후보에 없으면 effectiveId 파생이 안전 폴백).
    useEffect(() => {
        if (open && initialBoardId != null) setSelectedId(initialBoardId);
    }, [open, initialBoardId]);

    // 슬라이드-아웃 후 콘텐츠 언마운트 + 폭·뷰·상세 초기화.
    useEffect(() => {
        if (open) {
            setMounted(true);
            return;
        }
        setWide(false);
        setDetailCard(null);
        const t = window.setTimeout(() => {
            setMounted(false);
            setView("board");
        }, 300);
        return () => window.clearTimeout(t);
    }, [open]);

    // 현재 보고 있는 보드를 기억(localStorage 쓰기 — setState 아니라 재렌더 루프 없음).
    useEffect(() => {
        if (open && effectiveId != null) rememberLastViewedBoard(projectId, effectiveId);
    }, [open, effectiveId, projectId]);

    // ESC 로 닫기.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            // 카드 상세가 열려 있으면 상세의 ESC 핸들러에 양보(패널은 안 닫힘).
            if (e.key === "Escape" && !detailOpenRef.current) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    return (
        <>
            {/* 바깥(원고) 클릭으로 닫기 — 투명 캐처(원고 안 어두워짐). 열렸을 때만. */}
            <div aria-hidden onClick={onClose} className={`fixed inset-0 z-30 ${open ? "" : "hidden"}`} />

            <aside
                role="dialog"
                aria-label="보드 참조"
                aria-hidden={!open}
                className={`fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
                    wide ? "max-w-5xl" : "max-w-2xl"
                } ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
            >
                {(open || mounted) && (
                    <>
                        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                                <div role="tablist" aria-label="참조 뷰" className="flex shrink-0 items-center gap-4">
                                    {REF_VIEWS.map((v) => (
                                        <button
                                            key={v.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={view === v.key}
                                            onClick={() => setView(v.key)}
                                            className={`flex items-center gap-1.5 border-b-2 pb-0.5 text-[15px] font-bold transition ${
                                                view === v.key
                                                    ? "border-terracotta-600 text-terracotta-700"
                                                    : "border-transparent text-gray-400 hover:text-gray-600"
                                            }`}
                                        >
                                            <span aria-hidden>{v.icon}</span>
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                                {view === "board" && candidates.length > 1 && effectiveId != null && (
                                    <select
                                        value={effectiveId}
                                        onChange={(e) => setSelectedId(Number(e.target.value))}
                                        className="min-w-0 max-w-[12rem] truncate rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none"
                                        aria-label="참조할 보드 선택"
                                    >
                                        {/* 작품 보드(owner=project) / 시리즈 보드(owner=category) 구분 — 나머지(아이디어 등)는 기타. */}
                                        {(
                                            [
                                                { label: "작품 보드", type: "project" },
                                                { label: "시리즈 보드", type: "category" },
                                                { label: "기타 보드", type: null },
                                            ] as const
                                        ).map(({ label, type }) => {
                                            const group = candidates.filter((b) =>
                                                type === null
                                                    ? b.ownerType !== "project" && b.ownerType !== "category"
                                                    : b.ownerType === type,
                                            );
                                            if (group.length === 0) return null;
                                            return (
                                                <optgroup key={label} label={label}>
                                                    {group.map((b) => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.name} · {b.ownerLabel}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setWide((w) => !w)}
                                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                    title={wide ? "좁게" : "넓게"}
                                >
                                    {wide ? "⤢ 좁게" : "⤢ 넓게"}
                                </button>
                                {view === "board" && effectiveId != null && (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/boards/${effectiveId}`)}
                                        className="rounded-md border border-terracotta-200 px-2 py-1 text-xs font-medium text-terracotta-600 hover:bg-terracotta-50"
                                        title="보드 페이지로 이동"
                                    >
                                        ↗ 전체 화면
                                    </button>
                                )}
                                <button
                                    type="button"
                                    aria-label="보드 참조 닫기"
                                    onClick={onClose}
                                    className="rounded-md px-2 py-1 text-base text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    title="닫기 (ESC)"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-auto p-3">
                            {view === "card" ? (
                                <WritingCardView
                                    referenceBoards={candidates}
                                    boardsLoading={boards.isLoading}
                                    active={open && view === "card"}
                                    onOpenCard={setDetailCard}
                                />
                            ) : boards.isLoading ? (
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
                            ) : effectiveId == null ? (
                                <p className="py-12 text-center text-sm text-gray-400">보드를 여는 중…</p>
                            ) : (
                                <BoardReferenceCanvas key={effectiveId} boardId={effectiveId} />
                            )}
                        </div>
                    </>
                )}
            </aside>

            {/* 048 US6: 카드 뷰에서 카드 열기 — 읽기 전용 중앙 상세(portal, 패널 위). */}
            <WritingCardDetail card={detailCard} onClose={() => setDetailCard(null)} />
        </>
    );
}
