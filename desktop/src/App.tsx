import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "./components/Rail";
import { Dock } from "./components/Dock";
import { QuickCapture } from "./components/QuickCapture";
import { WriteStudioScreen } from "./screens/WriteStudioScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { MemoInboxScreen } from "./screens/MemoInboxScreen";
import { LogScreen } from "./screens/LogScreen";
import type { MemoState, SaveState, Screen, Theme } from "./types";

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
  // 선택된 작품 — Phase 3 는 진입 + 제목 표시까지. 문서 본문 결선은 Phase 4.
  const [activeProject, setActiveProject] = useState<{ id: string; title: string } | null>(null);
  const togglePanel = () => setPanelOpen((o) => !o);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // 자동저장 시뮬레이션: 입력 → 'saving' → debounce 후 'saved'.
  // 실제 로컬 persistence 는 desktop Phase 2. 여기선 상태 전이만.
  const handleTyping = useCallback(() => {
    setSave("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSave("saved"), AUTOSAVE_DELAY_MS);
  }, []);

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
          save={save}
          count={count}
          memos={memos}
          onCount={setCount}
          onTyping={handleTyping}
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
