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
  /** 서랍 내 곁쪽지 고정 토글. */
  onSetPinMemo: (memoId: string, pinned: boolean) => void;
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
  /** 작업 종료 — 기록 메모 본문을 받아 App 이 저장 처리(데이터 fetching은 App 소유 원칙). */
  onEndWork: (body: string) => void;
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
  onSetPinMemo,
  autoSave,
  onChange,
  onSaveNow,
  panelOpen,
  onTogglePanel,
  reentry,
  theme,
  onTheme,
  onAutoSave,
  onEndWork,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [endWorkOpen, setEndWorkOpen] = useState(false);
  const [endWorkBody, setEndWorkBody] = useState("");
  // 줄노트 default on — 빈 종이도 줄선이 페이지에 미리 그려진 상태로 진입한다.
  const [lined, setLined] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  // 재진입 한 장은 진입 직후 1회 — 작품(editorKey)이 바뀌면 다시 펼친다.
  const [reentryDismissed, setReentryDismissed] = useState(false);
  useEffect(() => {
    setReentryDismissed(false);
  }, [editorKey]);

  // 보기 팝오버와 곁쪽지 서랍은 상호 배타 — 둘이 동시에 떠 stacking 이 엉키지 않게 한다.
  const handleToggleView = () => {
    const next = !viewOpen;
    setViewOpen(next);
    if (next && panelOpen) onTogglePanel(); // 보기를 열면 서랍을 닫는다.
  };
  const handleTogglePanel = () => {
    if (!panelOpen) setViewOpen(false); // 서랍을 열면 보기를 닫는다.
    onTogglePanel();
  };

  const handleEndWorkSave = () => {
    const trimmed = endWorkBody.trim();
    if (!trimmed) return;
    onEndWork(trimmed);
    setEndWorkOpen(false);
    setEndWorkBody("");
  };

  const handleEndWorkCancel = () => {
    setEndWorkOpen(false);
    setEndWorkBody("");
  };

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
      <button
        type="button"
        className="btn btn--secondary btn--compact"
        onClick={() => {
          setEndWorkBody("");
          setEndWorkOpen(true);
        }}
      >
        작업 종료
      </button>
      <div className="view-anchor">
        <button
          type="button"
          className={viewOpen ? "panel-toggle is-open" : "panel-toggle"}
          aria-pressed={viewOpen}
          aria-label="보기"
          title="보기"
          onClick={handleToggleView}
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
        onClick={handleTogglePanel}
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
            zoom={zoom}
          />
          {showReentry && reentry && <ReentryCard reentry={reentry} onClose={() => setReentryDismissed(true)} />}
        </div>
        {panelOpen && (
          <MemoPanel memos={memos} loading={memosLoading} onUnlink={onUnlinkMemo} onSetPin={onSetPinMemo} />
        )}
      </div>

      {endWorkOpen && (
        <div className="modal-backdrop" onClick={handleEndWorkCancel}>
          <div
            className="modal capture"
            role="dialog"
            aria-modal="true"
            aria-label="작업 종료"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__head">
              <h2 className="modal__title">작업 종료</h2>
              <span className="modal__hint">오늘의 기록을 남겨보세요</span>
            </div>
            <textarea
              autoFocus
              className="capture__input"
              placeholder="오늘의 기록을 남겨보세요…"
              rows={4}
              value={endWorkBody}
              onChange={(e) => setEndWorkBody(e.target.value)}
            />
            <div className="modal__foot">
              <button type="button" className="btn btn--ghost" onClick={handleEndWorkCancel}>
                취소
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleEndWorkSave}
                disabled={endWorkBody.trim().length === 0}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
