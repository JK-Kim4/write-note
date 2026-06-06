import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Titlebar } from "../components/Titlebar";
import { Toast } from "../components/Toast";
import { LinkPopover } from "../components/LinkPopover";
import { toInboxMemoView } from "../lib/memoView";
import type { InboxMemo, LinkedProject } from "../types";

type Props = { refresh: number };

/** 쪽지 책상 — 흩어진 쪽지를 본문 중심으로 모아 보고, 어느 작품에 다시 붙일지 정한다.
 *  관리 언어(통계·미연결 카운터·세그먼트 필터) 없이, 작품 단위로 부드럽게 추린다. */
export function MemoInboxScreen({ refresh }: Props) {
  const [memos, setMemos] = useState<InboxMemo[] | null>(null);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  // 추림 — null 이면 전부, projectId 면 그 작품에 붙은 쪽지만.
  const [siftProjectId, setSiftProjectId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 붙이기 팝오버가 열린 메모 id (한 번에 하나).
  const [linkMenuFor, setLinkMenuFor] = useState<string | null>(null);
  // 가장 최근 삭제 1건 — 되돌리기 대상. number 는 토스트 remount key.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; seq: number } | null>(null);

  const load = useCallback(async () => {
    const [memoRows, projectRows] = await Promise.all([
      window.electronAPI.memos.list(),
      window.electronAPI.projects.list(),
    ]);
    const titleById = new Map(projectRows.map((p) => [p.id, p.title]));
    const now = new Date();
    setProjects(projectRows.map((p) => ({ id: p.id, title: p.title })));
    setMemos(memoRows.map((m) => toInboxMemoView(m, titleById, now)));
  }, []);

  // refresh(모달 캡처) 또는 마운트 시 재조회.
  useEffect(() => {
    void load();
  }, [load, refresh]);

  const handleAddInline = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      // inbox 인라인 캡처는 정리 공간 입력이라 미연결로 저장(설계 ui-components.md).
      await window.electronAPI.memos.create({ body: draft.trim(), linkProjectId: null });
      setDraft("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  // 낙관적 연결/해제 — IPC 왕복 전에 해당 memo row 를 즉시 갱신(이름표 동시 반영).
  const applyLinkOptimistic = (memoId: string, projectId: string, next: boolean) => {
    setMemos(
      (prev) =>
        prev?.map((m) => {
          if (m.id !== memoId) return m;
          if (!next) return { ...m, linkedProjects: m.linkedProjects.filter((lp) => lp.id !== projectId) };
          if (m.linkedProjects.some((lp) => lp.id === projectId)) return m;
          const title = projects.find((p) => p.id === projectId)?.title;
          if (title === undefined) return m;
          return { ...m, linkedProjects: [...m.linkedProjects, { id: projectId, title }] };
        }) ?? null,
    );
  };

  const handleToggleLink = async (memoId: string, projectId: string, next: boolean) => {
    applyLinkOptimistic(memoId, projectId, next);
    try {
      if (next) await window.electronAPI.memos.addLink(memoId, projectId);
      else await window.electronAPI.memos.removeLink(memoId, projectId);
    } catch {
      // 실패 시 서버 상태로 롤백.
      await load();
    }
  };

  const handleUnlink = async (memoId: string, projectId: string) => {
    applyLinkOptimistic(memoId, projectId, false);
    try {
      await window.electronAPI.memos.removeLink(memoId, projectId);
    } catch {
      // 실패 시 서버 상태로 롤백.
      await load();
    }
  };

  const handleDelete = async (id: string) => {
    // 낙관적 제거 — 즉시 사라지고 되돌리기 토스트 제시.
    setMemos((prev) => prev?.filter((m) => m.id !== id) ?? null);
    setPendingDelete((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
    await window.electronAPI.memos.delete(id);
  };

  const handleRestore = useCallback(async () => {
    if (!pendingDelete) return;
    await window.electronAPI.memos.restore(pendingDelete.id);
    setPendingDelete(null);
    await load();
  }, [pendingDelete, load]);

  const dismissToast = useCallback(() => setPendingDelete(null), []);

  // 추림에 쓸 작품 — 쪽지가 실제로 붙어 있는 작품만 노출(빈 추림 칩 방지).
  const siftProjects = useMemo(() => {
    if (memos === null) return [];
    const used = new Set(memos.flatMap((m) => m.linkedProjects.map((lp) => lp.id)));
    return projects.filter((p) => used.has(p.id));
  }, [memos, projects]);

  // 선택한 추림 작품이 더 이상 후보에 없으면(연결 전부 해제 등) 전부로 되돌린다.
  useEffect(() => {
    if (siftProjectId !== null && !siftProjects.some((p) => p.id === siftProjectId)) {
      setSiftProjectId(null);
    }
  }, [siftProjectId, siftProjects]);

  const shown =
    memos === null
      ? []
      : siftProjectId === null
        ? memos
        : memos.filter((m) => m.linkedProjects.some((lp) => lp.id === siftProjectId));

  const countPhrase = memos === null ? "" : memos.length === 0 ? "" : `쪽지 ${memos.length}장`;

  return (
    <div className="main">
      <Titlebar title="쪽지" right={countPhrase ? <span className="memo-deck__count">{countPhrase}</span> : undefined} />
      <div className="screen-body screen-body--solo">
        <div className="screen-main">
          <div className="memo-deck">
            <div className="memo-deck__bar">
              <h1 className="memo-deck__head">책상 위 쪽지</h1>
              {siftProjects.length > 0 && (
                <div className="sift-row" role="group" aria-label="작품으로 추리기">
                  <button
                    type="button"
                    className={siftProjectId === null ? "sift is-on" : "sift"}
                    aria-pressed={siftProjectId === null}
                    onClick={() => setSiftProjectId(null)}
                  >
                    전부
                  </button>
                  {siftProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={siftProjectId === p.id ? "sift is-on" : "sift"}
                      aria-pressed={siftProjectId === p.id}
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
              <button type="submit" className="btn btn--secondary" disabled={!draft.trim() || submitting}>
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
                            onClick={() => void handleUnlink(m.id, lp.id)}
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
                          onToggle={(pid, next) => void handleToggleLink(m.id, pid, next)}
                          onClose={() => setLinkMenuFor(null)}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      className="scrap__discard"
                      aria-label="쪽지 버리기"
                      onClick={() => void handleDelete(m.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))}
              {memos !== null && shown.length === 0 && (
                <div className="panel__empty">
                  {siftProjectId !== null
                    ? "이 작품에 붙인 쪽지가 아직 없어요."
                    : "아직 쪽지가 없어요. 떠오른 생각을 적어두세요."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <Toast
          key={pendingDelete.seq}
          message="쪽지를 버렸어요"
          actionLabel="되돌리기"
          onAction={() => void handleRestore()}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
