import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "./components/Rail";
import { Dock } from "./components/Dock";
import { QuickCapture } from "./components/QuickCapture";
import { WriteStudioScreen } from "./screens/WriteStudioScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { MemoInboxScreen } from "./screens/MemoInboxScreen";
import { LogScreen } from "./screens/LogScreen";
import { toInboxMemoView } from "./lib/memoView";
import type { DocumentChange, InboxMemo, SaveState, Screen, Theme } from "./types";

const AUTOSAVE_DELAY_MS = 700;

function initialParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(window.location.search).get(key);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => initialParam("theme", ["light", "dark"], "light"));
  const [screen, setScreen] = useState<Screen>(() =>
    initialParam("screen", ["projects", "write", "memo", "log"], "projects"),
  );
  const [save, setSave] = useState<SaveState>("saved");
  const [count, setCount] = useState(0);
  const [autoSave, setAutoSaveState] = useState(true);
  // 현재 작품에 연결된 메모(집필 패널). activeProject/memoRefresh 변화 시 재조회.
  const [panelMemos, setPanelMemos] = useState<InboxMemo[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  // 모달 캡처가 화면 밖(App)에 있으므로, 캡처 성공 시 이 카운터를 올려 inbox 재조회를 유도한다.
  const [memoRefresh, setMemoRefresh] = useState(0);
  // 선택된 작품 + 그 작품의 document(본문). 작품 선택 시 IPC 로 로드한다.
  const [activeProject, setActiveProject] = useState<{ id: string; title: string } | null>(null);
  const [activeDoc, setActiveDoc] = useState<{ id: string; bodyJson: string; editorKey: string } | null>(null);
  const togglePanel = () => setPanelOpen((o) => !o);
  const timer = useRef<number | undefined>(undefined);
  // 같은 작품을 다시 열어도 에디터를 최신 본문으로 remount 하기 위한 로드 시퀀스.
  const loadSeq = useRef(0);
  // 미저장 변경 — 자동저장 OFF 시 수동 저장(⌘S/버튼) + 켜기 전환 flush 용.
  const lastChange = useRef<{ docId: string; change: DocumentChange } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 자동저장 on/off 선호 로드(app_settings 영속).
  useEffect(() => {
    void window.electronAPI.settings.get("autosave_enabled").then((v) => {
      if (v !== null) setAutoSaveState(v !== "false");
    });
  }, []);

  // 작품 선택 → 해당 작품의 기본 document 로드(본문 + 글자수 복원).
  useEffect(() => {
    if (!activeProject) {
      setActiveDoc(null);
      return;
    }
    let cancelled = false;
    void window.electronAPI.documents.getByProject(activeProject.id).then((doc) => {
      if (cancelled || !doc) return;
      loadSeq.current += 1;
      setActiveDoc({ id: doc.id, bodyJson: doc.bodyJson, editorKey: `${doc.id}#${loadSeq.current}` });
      setCount(doc.wordCount);
      setSave("saved");
      lastChange.current = null;
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // 현재 작품 연결 메모 로드(집필 패널). 캡처/연결 변경(memoRefresh) 시에도 재조회(FR-009).
  useEffect(() => {
    if (!activeProject) {
      setPanelMemos([]);
      return;
    }
    let cancelled = false;
    setPanelLoading(true);
    void window.electronAPI.memos.listByProject(activeProject.id).then((rows) => {
      if (cancelled) return;
      const now = new Date();
      // 패널은 현재 작품이 자명하므로 작품명 칩을 표시하지 않는다(연결 제목 맵 불요).
      setPanelMemos(rows.map((m) => toInboxMemoView(m, new Map(), now)));
      setPanelLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, memoRefresh]);

  // 패널 내 빠른 해제 — 현재 작품과의 연결만 끊고 패널 즉시 갱신.
  const handlePanelUnlink = useCallback(
    (memoId: string) => {
      if (!activeProject) return;
      void window.electronAPI.memos.removeLink(memoId, activeProject.id).then(() => setMemoRefresh((n) => n + 1));
    },
    [activeProject],
  );

  // 실제 저장 — IPC update + 저장본을 activeDoc 에 반영(remount 시 최신 본문이 초기값이 되도록).
  const performSave = useCallback((docId: string, change: DocumentChange) => {
    setSave("saving");
    window.clearTimeout(timer.current);
    window.electronAPI.documents
      .update(docId, change)
      .then(() => {
        setSave("saved");
        lastChange.current = null;
        setActiveDoc((d) => (d && d.id === docId ? { ...d, bodyJson: change.bodyJson } : d));
      })
      .catch(() => setSave("error"));
  }, []);

  // 입력: 자동저장 ON 이면 debounce 저장, OFF 면 미저장 표시만(수동 저장 대기).
  const handleChange = useCallback(
    (change: DocumentChange) => {
      setCount(change.wordCount);
      const docId = activeDoc?.id;
      if (!docId) return;
      lastChange.current = { docId, change };
      if (!autoSave) {
        setSave("unsaved");
        return;
      }
      setSave("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => performSave(docId, change), AUTOSAVE_DELAY_MS);
    },
    [activeDoc, autoSave, performSave],
  );

  // 수동 저장(⌘S / 저장 버튼) — 미저장 변경을 즉시 저장.
  const saveNow = useCallback(() => {
    const pending = lastChange.current;
    if (pending) performSave(pending.docId, pending.change);
  }, [performSave]);

  // 자동저장 토글 + 영속. 켜는 순간 미저장분이 있으면 즉시 flush.
  const setAutoSave = useCallback(
    (v: boolean) => {
      setAutoSaveState(v);
      void window.electronAPI.settings.set("autosave_enabled", v ? "true" : "false");
      if (v) saveNow();
    },
    [saveNow],
  );

  // ⌘S / Ctrl+S 수동 저장(자동저장 on/off 무관 — 즉시 저장).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveNow]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className="app">
      <Rail active={screen} onNavigate={setScreen} onCapture={() => setCaptureOpen(true)} />

      {screen === "projects" && (
        <ProjectsScreen
          onOpenProject={(p) => {
            setActiveProject({ id: p.id, title: p.title });
            setScreen("write");
          }}
        />
      )}
      {screen === "write" && (
        <WriteStudioScreen
          projectTitle={activeProject?.title}
          editorKey={activeDoc?.editorKey ?? "loading"}
          initialBodyJson={activeDoc?.bodyJson ?? ""}
          save={save}
          count={count}
          memos={panelMemos}
          memosLoading={panelLoading}
          onUnlinkMemo={handlePanelUnlink}
          autoSave={autoSave}
          onChange={handleChange}
          onSaveNow={saveNow}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
        />
      )}
      {screen === "memo" && (
        <MemoInboxScreen refresh={memoRefresh} panelOpen={panelOpen} onTogglePanel={togglePanel} />
      )}
      {screen === "log" && <LogScreen panelOpen={panelOpen} onTogglePanel={togglePanel} />}

      <Dock theme={theme} setTheme={setTheme} autoSave={autoSave} setAutoSave={setAutoSave} />
      {captureOpen && (
        <QuickCapture
          activeProjectId={activeProject?.id ?? null}
          onClose={() => setCaptureOpen(false)}
          onCaptured={() => setMemoRefresh((n) => n + 1)}
        />
      )}
    </div>
  );
}
