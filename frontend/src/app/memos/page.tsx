"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useAuthGuard } from "@/lib/auth/guard";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { LinkPopover } from "@/components/memos/LinkPopover";
import { Toast } from "@/components/ui/Toast";
import { toInboxMemoView } from "@/lib/memoView";
import {
    useAddLinkMemo,
    useCaptureMemo,
    useDeleteMemo,
    useInboxMemos,
    useRemoveLinkMemo,
    useRestoreMemo,
} from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import type { LinkedProject } from "@/lib/types/domain";

/**
 * 메모 책상 (015 US2) — desktop MemoInboxScreen 1:1 이식. 006 `/memos` 폐기·교체.
 * 흩어진 쪽지를 본문 중심으로 모아 보고, 어느 작품에 다시 붙일지 정한다(작품 단위 추림).
 *
 * 버리기/되돌리기 (019 US1): soft-delete + restore. 버리면 낙관적으로 사라지고 되돌리기 토스트가 뜬다.
 */
export default function MemoDeskPage() {
    useAuthGuard("requireAuth");
    const now = useMemo(() => new Date(), []);
    const memosQuery = useInboxMemos();
    const cardsQuery = useProjectCards();
    const captureMemo = useCaptureMemo();
    const addLink = useAddLinkMemo();
    const removeLink = useRemoveLinkMemo();
    const deleteMemo = useDeleteMemo();
    const restoreMemo = useRestoreMemo();

    // 추림 — null 이면 전부, projectId 면 그 작품에 붙은 쪽지만.
    const [siftProjectId, setSiftProjectId] = useState<number | null>(null);
    const [draft, setDraft] = useState("");
    // 붙이기 팝오버가 열린 메모 id (한 번에 하나).
    const [linkMenuFor, setLinkMenuFor] = useState<number | null>(null);
    // 되돌리기 토스트 대상 — 연속 삭제는 건수로 묶는다(웹은 휴지통 화면이 없어 토스트가 유일한 복구 경로).
    // seq 로 새 삭제마다 Toast remount(타이머 재시작). 019 묶음 토스트 — desktop(단일 슬롯)과 의도적 차이.
    const [pendingDelete, setPendingDelete] = useState<{ ids: number[]; seq: number } | null>(null);

    const handleDelete = (memoId: number) => {
        setPendingDelete((prev) => ({ ids: [...(prev?.ids ?? []), memoId], seq: (prev?.seq ?? 0) + 1 }));
        deleteMemo.mutate(memoId);
    };

    const handleRestore = useCallback(() => {
        if (!pendingDelete) return;
        for (const id of pendingDelete.ids) restoreMemo.mutate(id);
        setPendingDelete(null);
    }, [pendingDelete, restoreMemo]);

    const dismissToast = useCallback(() => setPendingDelete(null), []);

    const memos = memosQuery.data ? memosQuery.data.map((m) => toInboxMemoView(m, now)) : null;
    const projects: LinkedProject[] = (cardsQuery.data ?? []).map((p) => ({ id: p.id, title: p.title }));

    const handleAddInline = async (e: FormEvent) => {
        e.preventDefault();
        if (!draft.trim() || captureMemo.isPending) return;
        // 책상 인라인 캡처는 정리 공간 입력이라 미연결로 저장.
        await captureMemo.mutateAsync({ body: draft.trim(), linkProjectId: null });
        setDraft("");
    };

    const handleToggleLink = (memoId: number, projectId: number, next: boolean) => {
        if (next) addLink.mutate({ memoId, projectId });
        else removeLink.mutate({ memoId, projectId });
    };

    const handleUnlink = (memoId: number, projectId: number) => removeLink.mutate({ memoId, projectId });

    // 추림에 쓸 작품 — 쪽지가 실제로 붙어 있는 작품만 노출(빈 추림 칩 방지).
    const siftProjects = useMemo(() => {
        if (memos === null) return [];
        const used = new Set(memos.flatMap((m) => m.linkedProjects.map((lp) => lp.id)));
        return projects.filter((p) => used.has(p.id));
    }, [memos, projects]);

    // 선택한 추림 작품이 더 이상 후보에 없으면(연결 전부 해제 등) 전부로 간주(렌더 중 파생 — effect setState 회피).
    const effectiveSiftId = siftProjectId !== null && siftProjects.some((p) => p.id === siftProjectId) ? siftProjectId : null;

    const shown =
        memos === null
            ? []
            : effectiveSiftId === null
              ? memos
              : memos.filter((m) => m.linkedProjects.some((lp) => lp.id === effectiveSiftId));

    return (
        <div className="app">
            <Rail />
            <div className="main">
                <Titlebar title="쪽지" />
                <div className="screen-body screen-body--solo">
                    <div className="screen-main">
                        <div className="memo-deck">
                            <div className="memo-deck__bar">
                                <h1 className="memo-deck__head">책상 위 쪽지</h1>
                                {siftProjects.length > 0 && (
                                    <div className="sift-row" role="group" aria-label="작품으로 추리기">
                                        <button
                                            type="button"
                                            className={effectiveSiftId === null ? "sift is-on" : "sift"}
                                            aria-pressed={effectiveSiftId === null}
                                            onClick={() => setSiftProjectId(null)}
                                        >
                                            전부
                                        </button>
                                        {siftProjects.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className={effectiveSiftId === p.id ? "sift is-on" : "sift"}
                                                aria-pressed={effectiveSiftId === p.id}
                                                onClick={() => setSiftProjectId(p.id)}
                                            >
                                                {p.title}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <form className="memo-jot" onSubmit={handleAddInline}>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="쪽지 한 줄 적기…"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                />
                                <button type="submit" className="btn btn--secondary" disabled={!draft.trim() || captureMemo.isPending}>
                                    추가
                                </button>
                            </form>

                            <div className="scatter">
                                {shown.map((m, i) => (
                                    <article
                                        key={m.id}
                                        className={linkMenuFor === m.id ? "scrap is-linking" : "scrap"}
                                        style={{ animationDelay: `${40 + i * 45}ms` }}
                                    >
                                        {m.linkedProjects.length > 0 && (
                                            <div className="scrap__tabs">
                                                {m.linkedProjects.map((lp) => (
                                                    <span key={lp.id} className="scrap__tab" title="붙인 작품">
                                                        {lp.title}
                                                        <button
                                                            type="button"
                                                            className="scrap__tab-x"
                                                            aria-label={`${lp.title} 연결 해제`}
                                                            onClick={() => handleUnlink(m.id, lp.id)}
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="scrap__body">{m.body}</p>
                                        <div className="scrap__foot">
                                            <span className="scrap__when">{m.dateLabel}</span>
                                            <div className="link-anchor">
                                                <button
                                                    type="button"
                                                    className="scrap__attach"
                                                    aria-label={m.linkedProjects.length > 0 ? "다른 작품에도 붙이기" : "작품에 붙이기"}
                                                    onClick={() => setLinkMenuFor((cur) => (cur === m.id ? null : m.id))}
                                                >
                                                    <span aria-hidden="true">＋</span>
                                                    {m.linkedProjects.length > 0 ? "다른 작품에도 붙이기" : "작품에 붙이기"}
                                                </button>
                                                {linkMenuFor === m.id && (
                                                    <LinkPopover
                                                        projects={projects}
                                                        linkedProjectIds={m.linkedProjects.map((lp) => lp.id)}
                                                        onToggle={(pid, next) => handleToggleLink(m.id, pid, next)}
                                                        onClose={() => setLinkMenuFor(null)}
                                                    />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="scrap__discard"
                                                aria-label="쪽지 버리기"
                                                onClick={() => handleDelete(m.id)}
                                            >
                                                <svg
                                                    width="15"
                                                    height="15"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                                                    <path d="M10 11v6M14 11v6" />
                                                </svg>
                                            </button>
                                        </div>
                                    </article>
                                ))}
                                {memos !== null && shown.length === 0 && (
                                    <div className="panel__empty">
                                        {effectiveSiftId !== null
                                            ? "이 작품에 붙인 쪽지가 아직 없어요."
                                            : "아직 쪽지가 없어요. 떠오른 생각을 적어두세요."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {pendingDelete && (
                <Toast
                    key={pendingDelete.seq}
                    message={
                        pendingDelete.ids.length === 1
                            ? "쪽지를 버렸어요."
                            : `쪽지 ${pendingDelete.ids.length}개를 버렸어요.`
                    }
                    actionLabel={pendingDelete.ids.length === 1 ? "되돌리기" : "모두 되돌리기"}
                    onAction={handleRestore}
                    onDismiss={dismissToast}
                />
            )}
        </div>
    );
}
