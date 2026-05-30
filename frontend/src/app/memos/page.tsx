"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { listMemos } from "@/lib/api/memo";
import { listProjects } from "@/lib/api/projects";
import { TopBar } from "@/components/shell/TopBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FilterChips, today } from "@/components/memos/FilterChips";
import { CurationCard } from "@/components/memos/CurationCard";
import type { FilterId, MemoFilterParams } from "@/components/memos/FilterChips";
import type { MemoResponse } from "@/types/api";

/**
 * 메모 inbox page — 실데이터 결선 + 큐레이션/필터 (006 US3 T048 + US4 T061).
 *
 * - GET /api/memos 필터 파라미터 실제 동작 (전체/미분류/프로젝트/인물/태그/q)
 * - 메모 카드 클릭 시 CurationCard 펼침 (한 번에 하나)
 * - FilterChips: 전체/미분류/오늘 + 프로젝트 동적 칩 + overlap 카운트
 * - US3 inbox 기존 동작 보존 (빈 상태 / 에러 / 로딩)
 *
 * Spec reference: contracts/route-surfaces.md §2-3 + 006 US4 backend 계약
 */

const SOURCE_LABEL: Record<string, string> = {
    DESKTOP: "💻",
    MOBILE: "📱",
};

const formatCapturedAt = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
        return `오늘 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
        return `어제 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

/** 오늘 날짜 string (YYYY-MM-DD) 기준 필터 */
const isCapturedToday = (isoString: string): boolean => {
    const d = new Date(isoString);
    const t = today();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return dateStr === t;
};

interface MemoCardProps {
    memo: MemoResponse;
    isExpanded: boolean;
    onToggle: () => void;
    onCurationClose: () => void;
}

function MemoCard({ memo, isExpanded, onToggle, onCurationClose }: MemoCardProps) {
    const projectCount = memo.projects.length;
    const isClassified = projectCount > 0;

    return (
        <li>
            <div
                className="p-5 rounded-card-memo"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: isExpanded ? "1px solid var(--w-accent)" : "1px solid var(--w-hairline)",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                }}
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                aria-expanded={isExpanded}
                aria-label={`메모: ${memo.body.slice(0, 40)}${memo.body.length > 40 ? "…" : ""}`}
            >
                <p style={{ color: "var(--w-ink)", lineHeight: 1.6 }}>{memo.body}</p>
                <div
                    className="flex items-center gap-3 mt-3 flex-wrap"
                    style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5 }}
                >
                    <span>{SOURCE_LABEL[memo.source] ?? memo.source}</span>
                    <span>{formatCapturedAt(memo.capturedAt)}</span>
                    {memo.tags.length > 0 && (
                        <span>{memo.tags.map((t) => `#${t}`).join(" ")}</span>
                    )}
                    {isClassified ? (
                        <span style={{ marginLeft: "auto", opacity: 0.8 }}>
                            {memo.projects.map((p) => p.title).join(", ")}
                        </span>
                    ) : (
                        <span style={{ marginLeft: "auto" }}>분류하기 →</span>
                    )}
                </div>
            </div>
            {isExpanded && (
                <CurationCard
                    memo={memo}
                    onClose={onCurationClose}
                />
            )}
        </li>
    );
}

export default function MemosPage() {
    useAuthGuard("requireAuth");

    const [activeFilter, setActiveFilter] = useState<FilterId>("all");
    const [filterParams, setFilterParams] = useState<MemoFilterParams>({});
    const [expandedMemoId, setExpandedMemoId] = useState<number | null>(null);

    // 필터 적용 메모 목록 쿼리
    const memosQuery = useQuery({
        queryKey: ["memos", { page: 0, size: 50, ...filterParams }],
        queryFn: () =>
            listMemos({
                page: 0,
                size: 50,
                sort: "capturedAt,desc",
                unclassified: filterParams.unclassified,
                projectId: filterParams.projectId,
                characterId: filterParams.characterId,
                tag: filterParams.tag,
            }),
        retry: false,
    });

    // 미분류 카운트 (FilterChips overlap 카운트용)
    const unclassifiedQuery = useQuery({
        queryKey: ["memos", { page: 0, size: 1, unclassified: true }],
        queryFn: () => listMemos({ page: 0, size: 1, unclassified: true }),
        retry: false,
    });

    // 프로젝트 목록 (동적 필터 칩용)
    const projectsQuery = useQuery({
        queryKey: ["projects", { page: 0, size: 100 }],
        queryFn: () => listProjects({ page: 0, size: 100 }),
        retry: false,
    });

    const handleFilterChange = useCallback((filterId: FilterId, params: MemoFilterParams) => {
        setActiveFilter(filterId);
        setFilterParams(params);
        setExpandedMemoId(null); // 필터 변경 시 펼쳐진 카드 닫기
    }, []);

    const handleMemoToggle = useCallback((memoId: number) => {
        setExpandedMemoId((prev) => (prev === memoId ? null : memoId));
    }, []);

    const handleCurationClose = useCallback(() => {
        setExpandedMemoId(null);
    }, []);

    // 오늘 필터 클라이언트 후처리 (backend 미지원 — capturedAt 기준)
    const rawMemos = memosQuery.data?.content ?? [];
    const memos =
        filterParams.todayOnly === true ? rawMemos.filter((m) => isCapturedToday(m.capturedAt)) : rawMemos;

    const totalCount = memosQuery.data?.totalElements ?? 0;
    const unclassifiedCount = unclassifiedQuery.data?.totalElements ?? 0;
    const projects = projectsQuery.data?.content ?? [];

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="메모 inbox" actions={<ThemeToggle />} />
            <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
                <FilterChips
                    activeFilter={activeFilter}
                    totalCount={totalCount}
                    unclassifiedCount={unclassifiedCount}
                    projects={projects}
                    onFilterChange={handleFilterChange}
                />

                {memosQuery.isLoading && (
                    <p style={{ color: "var(--w-ink)", opacity: 0.5, textAlign: "center", marginTop: "4rem" }}>
                        불러오는 중…
                    </p>
                )}

                {memosQuery.isError && (
                    <div style={{ textAlign: "center", marginTop: "4rem" }}>
                        <p style={{ color: "var(--w-ink)", opacity: 0.7 }}>메모를 불러오지 못했습니다.</p>
                        <button
                            type="button"
                            onClick={() => void memosQuery.refetch()}
                            className="mt-4 px-6 py-2 rounded-button-pill text-sm font-semibold"
                            style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {!memosQuery.isLoading && !memosQuery.isError && memos.length === 0 && (
                    <div style={{ textAlign: "center", marginTop: "4rem" }}>
                        <p style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "15px" }}>
                            아직 메모가 없습니다.
                        </p>
                        <p style={{ color: "var(--w-ink)", opacity: 0.4, fontSize: "13px", marginTop: "0.5rem" }}>
                            ⌘+N 으로 빠르게 캡처해 보세요.
                        </p>
                    </div>
                )}

                {memos.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {memos.map((m) => (
                            <MemoCard
                                key={m.id}
                                memo={m}
                                isExpanded={expandedMemoId === m.id}
                                onToggle={() => handleMemoToggle(m.id)}
                                onCurationClose={handleCurationClose}
                            />
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}
