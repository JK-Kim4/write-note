"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
    useAddLinkMemo,
    useCaptureMemo,
    useDeleteMemo,
    useInboxMemos,
    useRemoveLinkMemo,
    useRestoreMemo,
} from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import { MemoLinkFailedError } from "@/lib/electron-api/memos";
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

/** soft-delete 토스트 한 줄 — 마운트 시점 기준 독립 5초 타이머로 자동 닫힘(연속 버리기 시 reset 방지). */
function DeletedMemoToast({
    memoId,
    onRestore,
    onDismiss,
}: {
    memoId: number;
    onRestore: (memoId: number) => void;
    onDismiss: (memoId: number) => void;
}) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(memoId), 5000);
        return () => clearTimeout(timer);
    }, [memoId, onDismiss]);

    return (
        <div
            role="status"
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
            {/* 5초 타이머 진행바 — prefers-reduced-motion 에서는 표시 안 함 */}
            <div
                aria-hidden="true"
                className="h-0.5 w-full origin-left bg-terracotta-400 motion-safe:animate-[shrink_5s_linear_forwards]"
            />
            <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm text-muted-strong">메모를 버렸습니다.</span>
                <button
                    type="button"
                    onClick={() => onRestore(memoId)}
                    className="text-sm font-medium text-accent-text hover:text-accent-text"
                >
                    되돌리기
                </button>
                <button
                    type="button"
                    aria-label="닫기"
                    onClick={() => onDismiss(memoId)}
                    className="text-sm text-faint hover:text-muted-strong"
                >
                    ×
                </button>
            </div>
        </div>
    );
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
    // 연속 버리기 — 각 soft-delete 를 큐로 추적해 앞서 버린 메모도 개별 되돌리기 가능.
    const [deletedMemoIds, setDeletedMemoIds] = useState<number[]>([]);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);

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
        setCaptureError(null);
        try {
            await captureMemo.mutateAsync({
                body: trimmed,
                linkProjectId: draftProjectId === "none" ? null : draftProjectId,
            });
            setDraftBody("");
            // 다음 메모가 직전 작품에 의도치 않게 연결되지 않도록 연결 선택 초기화.
            setDraftProjectId("none");
        } catch (e) {
            if (e instanceof MemoLinkFailedError) {
                // 부분 성공 — 메모(POST)는 저장됐고 연결(curation)만 실패. draft 를 비워 동일 본문 재-POST(중복)를 막고
                // 메모 카드의 '+ 붙이기'로 다시 연결하도록 안내한다.
                setDraftBody("");
                setDraftProjectId("none");
                setCaptureError("메모는 저장됐지만 작품 연결에 실패했습니다. 메모 카드에서 '+ 붙이기'로 다시 연결해 주세요.");
                return;
            }
            // 1단계(POST) 자체 실패 — draft 는 비우지 않아 재시도 가능. 폼 하단에 에러를 노출한다.
            setCaptureError("메모를 남기지 못했습니다. 다시 시도해 주세요.");
        }
    };

    const handleDelete = (memoId: number) => {
        deleteMemo.mutate(memoId, {
            onSuccess: () => setDeletedMemoIds((prev) => (prev.includes(memoId) ? prev : [...prev, memoId])),
        });
    };

    const dismissToast = useCallback(
        (memoId: number) => setDeletedMemoIds((prev) => prev.filter((id) => id !== memoId)),
        [],
    );

    const handleRestore = useCallback(
        (memoId: number) => {
            setLinkError(null);
            restoreMemo.mutate(memoId, {
                // 성공 시에만 토스트 제거 — 실패하면 토스트(되돌리기 진입점)를 남기고 에러를 알린다.
                onSuccess: () => setDeletedMemoIds((prev) => prev.filter((id) => id !== memoId)),
                onError: () => setLinkError("되돌리기에 실패했습니다. 다시 시도해 주세요."),
            });
        },
        [restoreMemo],
    );

    const handleAddLink = (memoId: number, projectId: number) => {
        setLinkError(null);
        addLink.mutate({ memoId, projectId }, { onError: () => setLinkError("작품 연결에 실패했습니다. 다시 시도해 주세요.") });
    };

    const handleRemoveLink = (memoId: number, projectId: number) => {
        setLinkError(null);
        removeLink.mutate({ memoId, projectId }, { onError: () => setLinkError("작품 연결 해제에 실패했습니다. 다시 시도해 주세요.") });
    };

    // ESC 로 가장 최근 토스트를 닫는다. 자동 닫힘 타이머는 토스트별로 분리(DeletedMemoToast)해
    // 연속 버리기 시 앞선 토스트의 5초 타이머가 reset 되지 않게 한다.
    useEffect(() => {
        if (deletedMemoIds.length === 0) return;
        const newest = deletedMemoIds[deletedMemoIds.length - 1];
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") dismissToast(newest);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [deletedMemoIds, dismissToast]);

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
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                >
                    <option value="all">전체</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>

            {linkError && (
                <p role="alert" className="mb-4 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span aria-hidden="true">⚠</span>
                    {linkError}
                </p>
            )}

            {memosQuery.isLoading ? (
                <p className="py-12 text-center text-sm text-faint">불러오는 중…</p>
            ) : memosQuery.isError ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-muted">메모를 불러올 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => memosQuery.refetch()}
                        className="mt-3 rounded-md border border-border-strong px-4 py-2 text-sm text-muted-strong hover:bg-surface-2"
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <form
                        onSubmit={handleCapture}
                        className="flex flex-col rounded-xl border border-dashed border-border-strong bg-surface p-4"
                    >
                        <label htmlFor="memo-draft-body" className="sr-only">메모 내용</label>
                        <textarea
                            id="memo-draft-body"
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                            placeholder="떠오른 생각을 바로 적어두세요…"
                            rows={3}
                            className="w-full flex-1 resize-none rounded-md border border-border-strong px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <select
                                aria-label="연결할 작품"
                                value={draftProjectId === "none" ? "none" : String(draftProjectId)}
                                onChange={(e) =>
                                    setDraftProjectId(e.target.value === "none" ? "none" : Number(e.target.value))
                                }
                                className="min-w-0 flex-1 rounded-md border border-border-strong px-2 py-1.5 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
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
                                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                            >
                                남기기
                            </button>
                        </div>
                        {captureError && (
                            <p role="alert" className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600">
                                <span aria-hidden="true">⚠</span>
                                {captureError}
                            </p>
                        )}
                    </form>

                    {visibleMemos.map((memo) => (
                        <div key={memo.id} className="group flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4">
                            <p className="flex-1 text-sm whitespace-pre-wrap break-words text-ink-2">{memo.body}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                {memo.linkedProjects.map((p) => (
                                    <span
                                        key={p.id}
                                        className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text"
                                    >
                                        {p.title}
                                        <button
                                            type="button"
                                            aria-label={`${p.title} 연결 해제`}
                                            onClick={() => handleRemoveLink(memo.id, p.id)}
                                            className="text-terracotta-400 hover:text-accent-text"
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
                                                handleAddLink(memo.id, projectId);
                                            }
                                            setLinkTargetMemoId(null);
                                        }}
                                        className="rounded-md border border-border-strong px-2 py-0.5 text-xs focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
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
                                            className="rounded-full border border-dashed border-border-strong px-2 py-0.5 text-xs text-faint hover:border-terracotta-400 hover:text-accent-text"
                                        >
                                            + 붙이기
                                        </button>
                                    )
                                )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-faint">
                                <span>{relativeLabel(memo.capturedAt)}</span>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(memo.id)}
                                    disabled={deleteMemo.isPending}
                                    className="rounded-md border border-red-200 px-2 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                    {deleteMemo.isPending ? "버리는 중…" : "버리기"}
                                </button>
                            </div>
                        </div>
                    ))}
                    {visibleMemos.length === 0 && (
                        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-faint">
                            {filterProjectId === "all"
                                ? "아직 메모가 없습니다."
                                : "이 작품에 연결된 메모가 없습니다."}
                        </div>
                    )}
                </div>
            )}

            {deletedMemoIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col-reverse gap-2">
                    {deletedMemoIds.map((memoId) => (
                        <DeletedMemoToast
                            key={memoId}
                            memoId={memoId}
                            onRestore={handleRestore}
                            onDismiss={dismissToast}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
