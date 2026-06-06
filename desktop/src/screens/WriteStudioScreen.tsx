import { useEffect, useState, type CSSProperties } from "react";
import { Titlebar } from "../components/Titlebar";
import { Editor } from "../components/Editor";
import { MemoPanel } from "../components/MemoPanel";
import { ViewMenu } from "../components/ViewMenu";
import { ReentryCard } from "../components/ReentryCard";
import type { DocumentChange, InboxMemo, SaveState, Theme } from "../types";

/** 재진입 한 장 데이터 — 마지막 문장(본문 파생)·다음 장면(저장값)·곁에 둘 쪽지 1장. */
export type Reentry = {
  lastSentence: string | null;
  nextScene: string;
  memo: { body: string } | null;
};

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
  /** 현재 작품에 연결된 메모(곁쪽지 서랍). */
  memos: InboxMemo[];
  memosLoading: boolean;
  /** 서랍 내 연결 해제. */
  onUnlinkMemo: (memoId: string) => void;
  /** 자동저장 on/off — off 면 수동 저장 버튼을 노출한다. */
  autoSave: boolean;
  onChange: (change: DocumentChange) => void;
  /** 수동 저장(저장 버튼) — 자동저장 off 시 사용. */
  onSaveNow: () => void;
  /** 곁쪽지 서랍 토글. */
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** 재진입 한 장 — 집필 진입 직후 1회 표시. null 이면 표시하지 않는다. */
  reentry: Reentry | null;
  /** 테마(보기 메뉴). */
  theme: Theme;
  onTheme: (v: Theme) => void;
  /** 자동저장 토글(보기 메뉴). */
  onAutoSave: (v: boolean) => void;
};

/** 집필 화면 — 종이(본문)가 주인공. 보기/설정은 접힌 메뉴, 곁쪽지는 서랍, 진입 직후 재진입 한 장. */
export function WriteStudioScreen({
  projectTitle,
  editorKey,
  initialBodyJson,
  save,
  count,
  memos,
  memosLoading,
  onUnlinkMemo,
  autoSave,
  onChange,
  onSaveNow,
  panelOpen,
  onTogglePanel,
  reentry,
  theme,
  onTheme,
  onAutoSave,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [lined, setLined] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  // 재진입 한 장은 진입 직후 1회 — 작품(editorKey)이 바뀌면 다시 펼친다.
  const [reentryDismissed, setReentryDismissed] = useState(false);
  useEffect(() => {
    setReentryDismissed(false);
  }, [editorKey]);

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
      <div className="view-anchor">
        <button
          type="button"
          className={viewOpen ? "panel-toggle is-open" : "panel-toggle"}
          aria-pressed={viewOpen}
          aria-label="보기"
          title="보기"
          onClick={() => setViewOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          </svg>
        </button>
        {viewOpen && (
          <ViewMenu
            zoom={zoom}
            onZoom={setZoom}
            lined={lined}
            onLined={setLined}
            theme={theme}
            onTheme={onTheme}
            autoSave={autoSave}
            onAutoSave={onAutoSave}
            onClose={() => setViewOpen(false)}
          />
        )}
      </div>
      <button
        type="button"
        className={panelOpen ? "panel-toggle is-open" : "panel-toggle"}
        aria-pressed={panelOpen}
        aria-label="곁쪽지 서랍"
        title="곁쪽지 서랍"
        onClick={onTogglePanel}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </svg>
      </button>
    </>
  );

  const showReentry = reentry !== null && !reentryDismissed;

  return (
    <div className="main" style={{ "--zoom": zoom } as CSSProperties}>
      <Titlebar title={projectTitle ? `${projectTitle} — 집필` : "집필"} right={right} />
      <div className={`screen-body ${panelOpen ? "" : "screen-body--solo"}`}>
        <div className="studio">
          <Editor
            key={editorKey}
            title={projectTitle ?? ""}
            initialBodyJson={initialBodyJson}
            onChange={onChange}
            lined={lined}
          />
          {showReentry && reentry && <ReentryCard reentry={reentry} onClose={() => setReentryDismissed(true)} />}
        </div>
        {panelOpen && <MemoPanel memos={memos} loading={memosLoading} onUnlink={onUnlinkMemo} />}
      </div>
    </div>
  );
}
