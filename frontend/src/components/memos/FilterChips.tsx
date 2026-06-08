"use client";

import { useCallback } from "react";
import type { ProjectResponse } from "@/types/api";

/**
 * 필터 칩 + overlap 카운트 (006 US4 T060).
 *
 * - 전체 / 미분류 / 오늘 칩 + 프로젝트/인물/태그 동적 칩
 * - overlap 카운트: 메모가 여러 프로젝트에 연결된 경우 합산이 단순합보다 클 수 있음
 *   → 각 필터의 메모 수 표시 (totalElements 기반)
 * - 칩 선택 → onFilterChange 콜백으로 M1 쿼리 파라미터 전달
 *
 * RSC 경계: 이벤트 핸들러 + useCallback → 'use client' 의무
 */

export type FilterId =
    | "all"
    | "unclassified"
    | "today"
    | `project:${number}`
    | `character:${number}`
    | `tag:${string}`;

export interface FilterChipsFilter {
    id: FilterId;
    label: string;
    count?: number;
}

export interface MemoFilterParams {
    unclassified?: boolean;
    projectId?: number;
    characterId?: number;
    tag?: string;
    /** 오늘 필터: capturedAt 기준 오늘 날짜 범위는 backend 미지원 — 클라이언트 후처리 플래그 */
    todayOnly?: boolean;
}

interface FilterChipsProps {
    activeFilter: FilterId;
    totalCount: number;
    unclassifiedCount: number;
    projects: ReadonlyArray<ProjectResponse>;
    onFilterChange: (filterId: FilterId, params: MemoFilterParams) => void;
}

const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** overlap 카운트 설명 주석:
 * 메모가 여러 프로젝트에 연결될 수 있으므로 프로젝트 A 카운트 + 프로젝트 B 카운트 > 전체 카운트 가능.
 * 각 필터의 count 는 해당 필터 조건 GET /api/memos 의 totalElements — 단순 sum 아님.
 * 본 컴포넌트는 count 를 props 로 받으며, 실제 계산은 상위(memos page)에서 수행.
 */

export function FilterChips({
    activeFilter,
    totalCount,
    unclassifiedCount,
    projects,
    onFilterChange,
}: FilterChipsProps) {
    const handleClick = useCallback(
        (filterId: FilterId, params: MemoFilterParams) => {
            onFilterChange(filterId, params);
        },
        [onFilterChange],
    );

    const builtinChips: FilterChipsFilter[] = [
        { id: "all", label: "전체", count: totalCount },
        { id: "unclassified", label: "미분류", count: unclassifiedCount },
        { id: "today", label: "오늘" },
    ];

    const projectChips: FilterChipsFilter[] = projects.map((p) => ({
        id: `project:${p.id}` as FilterId,
        label: p.title,
    }));

    const allChips = [...builtinChips, ...projectChips];

    const paramsFor = (chip: FilterChipsFilter): MemoFilterParams => {
        if (chip.id === "all") return {};
        if (chip.id === "unclassified") return { unclassified: true };
        if (chip.id === "today") return { todayOnly: true };
        if (chip.id.startsWith("project:")) {
            const projectId = Number(chip.id.slice("project:".length));
            return { projectId };
        }
        if (chip.id.startsWith("character:")) {
            const characterId = Number(chip.id.slice("character:".length));
            return { characterId };
        }
        if (chip.id.startsWith("tag:")) {
            const tag = chip.id.slice("tag:".length);
            return { tag };
        }
        return {};
    };

    return (
        <div className="flex flex-wrap gap-2 mb-6" role="toolbar" aria-label="메모 필터">
            {allChips.map((chip) => {
                const isActive = chip.id === activeFilter;
                return (
                    <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleClick(chip.id, paramsFor(chip))}
                        className="px-4 py-2 rounded-button-pill text-sm font-semibold"
                        style={{
                            backgroundColor: isActive ? "var(--w-ink)" : "var(--w-canvas)",
                            color: isActive ? "var(--w-canvas)" : "var(--w-ink)",
                            border: "1px solid var(--w-hairline)",
                            cursor: "pointer",
                        }}
                        aria-pressed={isActive}
                    >
                        {chip.label}
                        {chip.count !== undefined && (
                            <span style={{ marginLeft: 6, opacity: 0.7 }}>{chip.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/** today() export — 외부에서 오늘 날짜 필터링에 사용 */
export { today };
