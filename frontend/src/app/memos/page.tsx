"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useAuthGuard } from "@/lib/auth/guard";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { LinkPopover } from "@/components/memos/LinkPopover";
import { toInboxMemoView } from "@/lib/memoView";
import { useAddLinkMemo, useCaptureMemo, useInboxMemos, useRemoveLinkMemo } from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import type { LinkedProject } from "@/lib/types/domain";

/**
 * 곁쪽지 책상 (015 US2) — desktop MemoInboxScreen 1:1 이식. 006 `/memos` 폐기·교체.
 * 흩어진 쪽지를 본문 중심으로 모아 보고, 어느 작품에 다시 붙일지 정한다(작품 단위 추림).
 *
 * 보류(별도 트랙): 쪽지 버리기 + 되돌리기 — 백엔드가 영구 삭제만 지원(soft-delete·restore 부재).
 * desktop 의 삭제/Toast 는 014 에 deletedAt + restore endpoint 추가 후 복원(015 범위 밖).
 */
export default function MemoDeskPage() {
    useAuthGuard("requireAuth");
    const now = useMemo(() => new Date(), []);
    const memosQuery = useInboxMemos();
    const cardsQuery = useProjectCards();
    const captureMemo = useCaptureMemo();
    const addLink = useAddLinkMemo();
    const removeLink = useRemoveLinkMemo();

    // 추림 — null 이면 전부, projectId 면 그 작품에 붙은 쪽지만.
    const [siftProjectId, setSiftProjectId] = useState<number | null>(null);
    const [draft, setDraft] = useState("");
    // 붙이기 팝오버가 열린 메모 id (한 번에 하나).
    const [linkMenuFor, setLinkMenuFor] = useState<number | null>(null);

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
        </div>
    );
}
