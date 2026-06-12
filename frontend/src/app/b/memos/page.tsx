"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
    useAddLinkMemo,
    useCaptureMemo,
    useDeleteMemo,
    useInboxMemos,
    useRemoveLinkMemo,
    useRestoreMemo,
} from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import type { Memo } from "@/lib/types/domain";

/**
 * B타입 메모 책상 — fable-test MemosPage 이식. 작품 필터 + 카드 그리드.
 * 공백 최소화: 그리드 첫 칸이 항상 작성 카드(빈 화면에도 기능이 먼저 보인다).
 * 버리기는 soft-delete — 하단 토스트에서 되돌리기.
 */

function relativeLabel(iso: string): string {
    const captured = new Date(iso).getTime();
    if (Number.isNaN(captured)) return "";
    const days = Math.floor((Date.now() - captured) / 86_400_000);
    if (days <= 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    return `${Math.floor(days / 7)}주 전`;
}

export default function BMemosPage() {
    const memosQuery = useInboxMemos();
    const projectsQuery = useProjectCards();
    const captureMemo = useCaptureMemo();
    const deleteMemo = useDeleteMemo();
    const restoreMemo = useRestoreMemo();
    const addLink = useAddLinkMemo();
    const removeLink = useRemoveLinkMemo();

    const [filterProjectId, setFilterProjectId] = useState<number | "all">("all");
    const [draftBody, setDraftBody] = useState("");
    const [draftProjectId, setDraftProjectId] = useState<number | "none">("none");
    const [linkTargetMemoId, setLinkTargetMemoId] = useState<number | null>(null);
    const [deletedMemoId, setDeletedMemoId] = useState<number | null>(null);

    const projects = projectsQuery.data ?? [];

    const visibleMemos = useMemo(() => {
        const memos = memosQuery.data ?? [];
        return filterProjectId === "all"
            ? memos
            : memos.filter((m) => m.linkedProjects.some((p) => p.id === filterProjectId));
    }, [memosQuery.data, filterProjectId]);

    const handleCapture = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = draftBody.trim();
        if (!trimmed || captureMemo.isPending) return;
        await captureMemo.mutateAsync({
            body: trimmed,
            linkProjectId: draftProjectId === "none" ? null : draftProjectId,
        });
        setDraftBody("");
    };

    const handleDelete = (memoId: number) => {
        deleteMemo.mutate(memoId, { onSuccess: () => setDeletedMemoId(memoId) });
    };

    const handleRestore = () => {
        if (deletedMemoId == null) return;
        restoreMemo.mutate(deletedMemoId, { onSettled: () => setDeletedMemoId(null) });
    };

    const linkableProjects = (memo: Memo) =>
        projects.filter((p) => !memo.linkedProjects.some((lp) => lp.id === p.id));

    return (
        <div>
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold">메모</h1>
                <select
                    aria-label="작품 필터"
                    value={filterProjectId === "all" ? "all" : String(filterProjectId)}
                    onChange={(e) =>
                        setFilterProjectId(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                    <option value="all">전체</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>

            {memosQuery.isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <form
                        onSubmit={handleCapture}
                        className="flex flex-col rounded-xl border border-dashed border-gray-300 bg-white p-4"
                    >
                        <textarea
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                            placeholder="떠오른 생각을 바로 적어두세요…"
                            rows={3}
                            className="w-full flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <select
                                aria-label="연결할 작품"
                                value={draftProjectId === "none" ? "none" : String(draftProjectId)}
                                onChange={(e) =>
                                    setDraftProjectId(e.target.value === "none" ? "none" : Number(e.target.value))
                                }
                                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="none">연결 안 함</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={draftBody.trim().length === 0 || captureMemo.isPending}
                                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                남기기
                            </button>
                        </div>
                    </form>

                    {visibleMemos.map((memo) => (
                        <div key={memo.id} className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4">
                            <p className="flex-1 text-sm whitespace-pre-wrap text-gray-700">{memo.body}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                {memo.linkedProjects.map((p) => (
                                    <span
                                        key={p.id}
                                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                                    >
                                        {p.title}
                                        <button
                                            type="button"
                                            aria-label={`${p.title} 연결 해제`}
                                            onClick={() => removeLink.mutate({ memoId: memo.id, projectId: p.id })}
                                            className="text-indigo-400 hover:text-indigo-700"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                {linkTargetMemoId === memo.id ? (
                                    <select
                                        autoFocus
                                        aria-label="붙일 작품 선택"
                                        defaultValue=""
                                        onBlur={() => setLinkTargetMemoId(null)}
                                        onChange={(e) => {
                                            const projectId = Number(e.target.value);
                                            if (Number.isFinite(projectId) && projectId > 0) {
                                                addLink.mutate({ memoId: memo.id, projectId });
                                            }
                                            setLinkTargetMemoId(null);
                                        }}
                                        className="rounded-md border border-gray-300 px-2 py-0.5 text-xs focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="" disabled>
                                            작품 선택
                                        </option>
                                        {linkableProjects(memo).map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.title}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    linkableProjects(memo).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setLinkTargetMemoId(memo.id)}
                                            className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400 hover:border-indigo-400 hover:text-indigo-600"
                                        >
                                            + 붙이기
                                        </button>
                                    )
                                )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                                <span>{relativeLabel(memo.capturedAt)}</span>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(memo.id)}
                                    className="rounded-md border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50"
                                >
                                    버리기
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {memosQuery.isError && (
                <p className="py-12 text-center text-sm text-gray-500">메모를 불러올 수 없습니다.</p>
            )}

            {deletedMemoId != null && (
                <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-lg">
                    <span className="text-sm text-gray-600">곁쪽지를 버렸습니다.</span>
                    <button
                        type="button"
                        onClick={handleRestore}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        되돌리기
                    </button>
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={() => setDeletedMemoId(null)}
                        className="text-sm text-gray-400 hover:text-gray-600"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
