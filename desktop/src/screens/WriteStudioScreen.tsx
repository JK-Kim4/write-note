import { useState, type CSSProperties } from "react";
import { Titlebar } from "../components/Titlebar";
import { Editor } from "../components/Editor";
import { MemoPanel } from "../components/MemoPanel";
import { PanelToggle } from "../components/PanelToggle";
import { ZoomControl } from "../components/ZoomControl";
import type { DocumentChange, MemoState, SaveState } from "../types";

function saveLabel(save: SaveState, count: number): string {
  if (save === "saving") return "저장 중…";
  if (save === "error") return "저장 실패 · 다시 시도";
  if (save === "unsaved") return `저장 안 됨 · ${count.toLocaleString("ko-KR")}자`;
  return `저장됨 · ${count.toLocaleString("ko-KR")}자`;
}

type Props = {
  /** 선택된 작품 제목 — 없으면 "집필". */
  projectTitle?: string;
  /** 에디터 remount key — 작품을 다시 열 때마다 갱신되어 최신 본문을 반영한다(로드 전이면 "loading"). */
  editorKey: string;
  /** 초기 본문(document.bodyJson). editorKey 가 바뀌면 이 값으로 에디터가 remount 된다. */
  initialBodyJson: string;
  save: SaveState;
  count: number;
  memos: MemoState;
  /** 자동저장 on/off — off 면 수동 저장 버튼을 노출한다. */
  autoSave: boolean;
  onChange: (change: DocumentChange) => void;
  /** 수동 저장(저장 버튼) — 자동저장 off 시 사용. */
  onSaveNow: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
};

/** 집필 화면 — 에디터(주인공) + 연결된 메모 패널(토글) + 작업공간 줌. */
export function WriteStudioScreen({
  projectTitle,
  editorKey,
  initialBodyJson,
  save,
  count,
  memos,
  autoSave,
  onChange,
  onSaveNow,
  panelOpen,
  onTogglePanel,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [lined, setLined] = useState(false);

  const right = (
    <>
      <div className={`savestate savestate--${save}`} role="status" aria-live="polite">
        <span className="savestate__dot" aria-hidden="true" />
        <span className="savestate__label">{saveLabel(save, count)}</span>
      </div>
      {!autoSave && (
        <button
          type="button"
          className="btn btn--secondary btn--compact"
          onClick={onSaveNow}
          disabled={save !== "unsaved"}
          title="저장 (⌘S)"
        >
          저장
        </button>
      )}
      <ZoomControl zoom={zoom} onZoom={setZoom} />
      <button
        type="button"
        className={lined ? "panel-toggle is-open" : "panel-toggle"}
        aria-pressed={lined}
        aria-label="줄노트"
        title="줄노트"
        onClick={() => setLined((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <PanelToggle open={panelOpen} onToggle={onTogglePanel} label="연결된 메모" />
    </>
  );

  return (
    <div className="main" style={{ "--zoom": zoom } as CSSProperties}>
      <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <Editor
          key={editorKey}
          title={projectTitle ?? ""}
          initialBodyJson={initialBodyJson}
          onChange={onChange}
          lined={lined}
        />
        {panelOpen && <MemoPanel state={memos} />}
      </div>
    </div>
  );
}
