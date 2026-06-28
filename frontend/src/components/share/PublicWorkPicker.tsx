"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ApiError } from "@/lib/api/client";
import { useProjectCards } from "@/lib/query/useProjects";
import { useSetPublicWorks } from "@/lib/query/useShares";

/**
 * 시리즈 공개 작품 선택(046 R4 / US3) — 시리즈 공유 링크에서 공개할 작품을 직접 고른다.
 *
 * 시리즈 소속 작품(categoryId 일치, 보관 제외)을 체크박스로 보여주고, 저장 시 setPublicWorks 로 확정한다.
 * 추가분은 그 시점 본문이 공유본으로 동결되고(FR-014), 제거분 스냅샷은 삭제된다. 시리즈 전체 자동 공개는 없다(FR-012).
 */
type Props = {
    linkId: number;
    /** 시리즈 공유 링크의 targetId = category.id. */
    categoryId: number;
    /** 현재 공개(스냅샷 동결)된 작품 id 목록 — 초기 체크 상태. */
    currentProjectIds: number[];
    onClose: () => void;
};

export function PublicWorkPicker({ linkId, categoryId, currentProjectIds, onClose }: Props) {
    const { data: cards, isPending } = useProjectCards();
    const setPublicWorks = useSetPublicWorks();
    const [checked, setChecked] = useState<Set<number>>(() => new Set(currentProjectIds));
    const [error, setError] = useState<string | null>(null);

    // 시리즈 소속 활성 작품만(미분류·타 시리즈·보관 제외).
    const works = (cards ?? []).filter((c) => c.categoryId === categoryId && c.archivedAt == null);

    const toggle = (id: number) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = () => {
        setError(null);
        setPublicWorks.mutate(
            { id: linkId, projectIds: [...checked] },
            {
                onSuccess: () => onClose(),
                onError: (e: unknown) =>
                    setError(e instanceof ApiError ? e.message : "공개 작품을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."),
            },
        );
    };

    if (typeof document === "undefined") return null;
    return createPortal(
        <div role="dialog" aria-label="공개 작품 선택" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-[28rem] max-w-[92vw] rounded-2xl bg-surface p-5 shadow-xl">
                <h2 className="text-base font-bold text-ink">공개할 작품 선택</h2>
                <p className="mt-1 text-xs text-muted">공유 페이지에 보일 작품을 고르세요. 고른 순간의 본문이 공유본으로 고정됩니다.</p>

                {isPending ? (
                    <p className="mt-4 text-sm text-faint">불러오는 중…</p>
                ) : works.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                        이 시리즈에 공개할 작품이 없어요.
                    </p>
                ) : (
                    <ul className="mt-3 max-h-60 space-y-1 overflow-auto">
                        {works.map((work) => (
                            <li key={work.id} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                                <input
                                    id={`public-work-${work.id}`}
                                    type="checkbox"
                                    checked={checked.has(work.id)}
                                    onChange={() => toggle(work.id)}
                                />
                                <label htmlFor={`public-work-${work.id}`} className="flex-1 truncate text-sm text-ink">
                                    {work.title}
                                </label>
                            </li>
                        ))}
                    </ul>
                )}

                {error ? (
                    <p role="alert" className="mt-3 text-xs text-red-500">
                        {error}
                    </p>
                ) : null}

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-strong">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={setPublicWorks.isPending}
                        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                    >
                        {setPublicWorks.isPending ? "저장 중…" : "저장"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
