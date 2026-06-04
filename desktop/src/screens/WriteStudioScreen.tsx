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
  return `저장됨 · ${count.toLocaleString("ko-KR")}자`;
}

type Props = {
  /** 선택된 작품 제목 — 없으면 "집필". */
  projectTitle?: string;
  /** 선택 작품의 document id — 로드 전이면 undefined(빈 에디터). */
  documentId?: string;
  /** 초기 본문(document.bodyJson). document 가 바뀌면 key 로 에디터를 remount 한다. */
  initialBodyJson: string;
  save: SaveState;
  count: number;
  memos: MemoState;
  onChange: (change: DocumentChange) => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
};

/** 집필 화면 — 에디터(주인공) + 연결된 메모 패널(토글) + 작업공간 줌. */
export function WriteStudioScreen({
  projectTitle,
  documentId,
  initialBodyJson,
  save,
  count,
  memos,
  onChange,
  panelOpen,
  onTogglePanel,
}: Props) {
  const [zoom, setZoom] = useState(1);

  const right = (
    <>
      <div className={`savestate savestate--${save}`} role="status" aria-live="polite">
        <span className="savestate__dot" aria-hidden="true" />
        <span className="savestate__label">{saveLabel(save, count)}</span>
      </div>
      <ZoomControl zoom={zoom} onZoom={setZoom} />
      <PanelToggle open={panelOpen} onToggle={onTogglePanel} label="연결된 메모" />
    </>
  );

  return (
    <div className="main" style={{ "--zoom": zoom } as CSSProperties}>
      <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <Editor key={documentId ?? "loading"} title={projectTitle ?? ""} initialBodyJson={initialBodyJson} onChange={onChange} />
        {panelOpen && <MemoPanel state={memos} />}
      </div>
    </div>
  );
}
