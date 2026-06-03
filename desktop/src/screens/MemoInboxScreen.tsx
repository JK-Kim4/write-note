import { useState } from "react";
import { Titlebar } from "../components/Titlebar";
import { PanelToggle } from "../components/PanelToggle";
import type { InboxMemo } from "../types";

const MEMOS: InboxMemo[] = [
  { id: "m1", body: "주인공이 바다를 처음 본 건 일곱 살. 그 기억을 3장 어딘가에 심을 것.", date: "5월 28일", linkedProject: "바다가 보이는 방" },
  { id: "m2", body: "“달라진 건 바다가 아니라 바라보는 마음” — 이 문장을 살려서 쓰기.", date: "5월 30일", linkedProject: "바다가 보이는 방" },
  { id: "m3", body: "지하철에서 본 노인의 손. 마디마다 다른 이야기가 적힌 것 같았다.", date: "5월 31일", linkedProject: null },
  { id: "m4", body: "제목 후보: 『물의 기억』 · 『파란 시간』 · 『창문 너머』", date: "6월 1일", linkedProject: null },
];

const UNLINKED = MEMOS.filter((m) => !m.linkedProject).length;

type Filter = "all" | "unlinked";
type Props = { panelOpen: boolean; onTogglePanel: () => void };

/** 메모 화면 — 캡처한 메모 모음 + 프로젝트 연결/필터 (좌), 메모 현황 (우측 토글). */
export function MemoInboxScreen({ panelOpen, onTogglePanel }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? MEMOS : MEMOS.filter((m) => !m.linkedProject);

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

            <form className="memo-new" onSubmit={(e) => e.preventDefault()}>
              <input className="input" type="text" placeholder="메모 한 줄 적기…" />
              <button type="submit" className="btn btn--secondary">추가</button>
            </form>

            <div className="memo-list">
              {shown.map((m, i) => (
                <article key={m.id} className="inbox-memo" style={{ animationDelay: `${40 + i * 45}ms` }}>
                  <p className="inbox-memo__body">{m.body}</p>
                  <div className="inbox-memo__foot">
                    <span className="inbox-memo__date">{m.date}</span>
                    {m.linkedProject ? (
                      <button type="button" className="link-chip" title="연결된 작품">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 12h6M10 7H8a4 4 0 0 0 0 8h2M14 7h2a4 4 0 0 1 0 8h-2" />
                        </svg>
                        {m.linkedProject}
                      </button>
                    ) : (
                      <button type="button" className="link-chip link-chip--empty">미연결 · 연결하기</button>
                    )}
                  </div>
                </article>
              ))}
              {shown.length === 0 && <div className="panel__empty">미연결 메모가 없어요.</div>}
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
              <span className="stat-card__num">{MEMOS.length}</span>
              <span className="stat-card__label">전체 메모</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__num">{UNLINKED}</span>
              <span className="stat-card__label">미연결</span>
            </div>
            <p className="panel__hint">미연결 메모를 작품에 연결하면 집필 중 곁에서 다시 만나요.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
