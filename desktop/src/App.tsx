import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "./components/Rail";
import { Dock } from "./components/Dock";
import { QuickCapture } from "./components/QuickCapture";
import { WriteStudioScreen } from "./screens/WriteStudioScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { MemoInboxScreen } from "./screens/MemoInboxScreen";
import { LogScreen } from "./screens/LogScreen";
import type { DocumentChange, MemoState, SaveState, Screen, Theme } from "./types";

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
  const [memos, setMemos] = useState<MemoState>("loaded");
  const [panelOpen, setPanelOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  // 선택된 작품 + 그 작품의 document(본문). 작품 선택 시 IPC 로 로드한다.
  const [activeProject, setActiveProject] = useState<{ id: string; title: string } | null>(null);
  const [activeDoc, setActiveDoc] = useState<{ id: string; bodyJson: string } | null>(null);
  const togglePanel = () => setPanelOpen((o) => !o);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 작품 선택 → 해당 작품의 기본 document 로드(본문 + 글자수 복원).
  useEffect(() => {
    if (!activeProject) {
      setActiveDoc(null);
      return;
    }
    let cancelled = false;
    void window.electronAPI.documents.getByProject(activeProject.id).then((doc) => {
      if (cancelled || !doc) return;
      setActiveDoc({ id: doc.id, bodyJson: doc.bodyJson });
      setCount(doc.wordCount);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // 자동저장: 입력 → 'saving' → debounce 후 documents.update IPC → 성공 'saved' / 실패 'error'.
  const handleChange = useCallback(
    (change: DocumentChange) => {
      setCount(change.wordCount);
      const docId = activeDoc?.id;
      if (!docId) return;
      setSave("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        window.electronAPI.documents
          .update(docId, change)
          .then(() => setSave("saved"))
          .catch(() => setSave("error"));
      }, AUTOSAVE_DELAY_MS);
    },
    [activeDoc],
  );

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
          documentId={activeDoc?.id}
          initialBodyJson={activeDoc?.bodyJson ?? ""}
          save={save}
          count={count}
          memos={memos}
          onChange={handleChange}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
        />
      )}
      {screen === "memo" && <MemoInboxScreen panelOpen={panelOpen} onTogglePanel={togglePanel} />}
      {screen === "log" && <LogScreen panelOpen={panelOpen} onTogglePanel={togglePanel} />}

      <Dock
        theme={theme}
        setTheme={setTheme}
        save={save}
        setSave={setSave}
        memos={memos}
        setMemos={setMemos}
        screen={screen}
      />
      {captureOpen && <QuickCapture onClose={() => setCaptureOpen(false)} />}
    </div>
  );
}
