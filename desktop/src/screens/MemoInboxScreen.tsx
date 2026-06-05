import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Titlebar } from "../components/Titlebar";
import { PanelToggle } from "../components/PanelToggle";
import { Toast } from "../components/Toast";
import { toInboxMemoView } from "../lib/memoView";
import type { InboxMemo } from "../types";

type Filter = "all" | "unlinked";
type Props = { refresh: number; panelOpen: boolean; onTogglePanel: () => void };

/** 메모 화면 — 캡처한 메모 모음 + 필터 + soft delete(좌), 메모 현황(우측 토글). */
export function MemoInboxScreen({ refresh, panelOpen, onTogglePanel }: Props) {
  const [memos, setMemos] = useState<InboxMemo[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 가장 최근 삭제 1건 — 되돌리기 대상. number 는 토스트 remount key.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; seq: number } | null>(null);

  const load = useCallback(async () => {
    const [memoRows, projectRows] = await Promise.all([
      window.electronAPI.memos.list(),
      window.electronAPI.projects.list(),
    ]);
    const titleById = new Map(projectRows.map((p) => [p.id, p.title]));
    const now = new Date();
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
      await window.electronAPI.memos.create({ body: draft.trim(), linkedProjectId: null });
      setDraft("");
      await load();
    } finally {
      setSubmitting(false);
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

  const shown = memos === null ? [] : filter === "all" ? memos : memos.filter((m) => !m.linkedProjectId);
  const total = memos?.length ?? 0;
  const unlinked = memos?.filter((m) => !m.linkedProjectId).length ?? 0;

  return (
    <div className="main">
      <Titlebar title="메모" right={<PanelToggle open={panelOpen} onToggle={onTogglePanel} label="메모 현황" />} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <div className="screen-main">
          <div className="memo-inbox">
            <div className="memo-toolbar">
              <div className="seg" role="group" aria-label="필터">
                <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>전체</button>
                <button type="button" aria-pressed={filter === "unlinked"} onClick={() => setFilter("unlinked")}>미연결</button>
              </div>
              <span className="memo-count">{shown.length}개</span>
            </div>

            <form className="memo-new" onSubmit={handleAddInline}>
              <input
                className="input"
                type="text"
                placeholder="메모 한 줄 적기…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn btn--secondary" disabled={!draft.trim() || submitting}>추가</button>
            </form>

            <div className="memo-list">
              {shown.map((m, i) => (
                <article key={m.id} className="inbox-memo" style={{ animationDelay: `${40 + i * 45}ms` }}>
                  <p className="inbox-memo__body">{m.body}</p>
                  <div className="inbox-memo__foot">
                    <span className="inbox-memo__date">{m.dateLabel}</span>
                    <div className="inbox-memo__actions">
                      {m.linkedProjectTitle ? (
                        <span className="link-chip" title="연결된 작품">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 12h6M10 7H8a4 4 0 0 0 0 8h2M14 7h2a4 4 0 0 1 0 8h-2" />
                          </svg>
                          {m.linkedProjectTitle}
                        </span>
                      ) : (
                        <span className="link-chip link-chip--empty">미연결</span>
                      )}
                      <button
                        type="button"
                        className="inbox-memo__del"
                        aria-label="메모 삭제"
                        onClick={() => void handleDelete(m.id)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {memos !== null && shown.length === 0 && (
                <div className="panel__empty">
                  {filter === "unlinked" ? "미연결 메모가 없어요." : "아직 메모가 없어요. 떠오른 생각을 적어두세요."}
                </div>
              )}
            </div>
          </div>
        </div>

        {panelOpen && (
          <aside className="side-panel" aria-label="메모 현황">
            <div className="panel__head">
              <h2 className="panel__title">메모 현황</h2>
              <p className="panel__sub">캡처 흐름</p>
            </div>
            <div className="stat-card">
              <span className="stat-card__num">{total}</span>
              <span className="stat-card__label">전체 메모</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__num">{unlinked}</span>
              <span className="stat-card__label">미연결</span>
            </div>
            <p className="panel__hint">미연결 메모를 작품에 연결하면 집필 중 곁에서 다시 만나요.</p>
          </aside>
        )}
      </div>

      {pendingDelete && (
        <Toast
          key={pendingDelete.seq}
          message="메모를 삭제했어요"
          actionLabel="되돌리기"
          onAction={() => void handleRestore()}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}
