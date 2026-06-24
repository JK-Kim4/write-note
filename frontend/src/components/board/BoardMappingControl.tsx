"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useCategories } from "@/lib/query/useCategories";
import { useProjectCards } from "@/lib/query/useProjects";
import { useSetBoardCategory, useSetBoardProject } from "@/lib/query/useBoards";

/**
 * 보드 매핑 컨트롤(US3) — 작품(0~1)·시리즈(0~1) 매핑/해제. 대상당 보드 1개라 충돌 시 409 안내.
 */
export function BoardMappingControl({
    boardId,
    projectId,
    categoryId,
}: {
    boardId: number;
    projectId: number | null;
    categoryId: number | null;
}) {
    const projects = useProjectCards();
    const categories = useCategories();
    const setProject = useSetBoardProject();
    const setCategory = useSetBoardCategory();
    const [error, setError] = useState<string | null>(null);

    const projectList = projects.data ?? [];
    const categoryList = categories.data ?? [];

    const onProjectChange = (value: string) => {
        setError(null);
        const next = value === "" ? null : Number(value);
        setProject.mutate(
            { id: boardId, projectId: next },
            {
                onError: (err) =>
                    setError(
                        err instanceof ApiError && err.code === "BOARD_PROJECT_ALREADY_MAPPED"
                            ? "이미 보드가 연결된 작품입니다."
                            : "작품 연결에 실패했습니다.",
                    ),
            },
        );
    };

    const onCategoryChange = (value: string) => {
        setError(null);
        const next = value === "" ? null : Number(value);
        setCategory.mutate(
            { id: boardId, categoryId: next },
            {
                onError: (err) =>
                    setError(
                        err instanceof ApiError && err.code === "BOARD_CATEGORY_ALREADY_MAPPED"
                            ? "이미 보드가 연결된 시리즈입니다."
                            : "시리즈 연결에 실패했습니다.",
                    ),
            },
        );
    };

    const selectClass =
        "min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-terracotta-500 focus:outline-none";

    return (
        <div className="mt-2">
            <div className="flex items-center gap-2">
                <select
                    aria-label="작품 연결"
                    value={projectId == null ? "" : String(projectId)}
                    onChange={(e) => onProjectChange(e.target.value)}
                    className={selectClass}
                >
                    <option value="">작품: 연결 안 함</option>
                    {projectList.map((p) => (
                        <option key={p.id} value={p.id}>
                            작품: {p.title}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="시리즈 연결"
                    value={categoryId == null ? "" : String(categoryId)}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    className={selectClass}
                >
                    <option value="">시리즈: 연결 안 함</option>
                    {categoryList.map((c) => (
                        <option key={c.id} value={c.id}>
                            시리즈: {c.name}
                        </option>
                    ))}
                </select>
            </div>
            {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
