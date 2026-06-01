import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "./components/Rail";
import { Titlebar } from "./components/Titlebar";
import { Editor } from "./components/Editor";
import { MemoPanel } from "./components/MemoPanel";
import { Dock } from "./components/Dock";
import type { MemoState, SaveState, Theme } from "./types";

const AUTOSAVE_DELAY_MS = 700;

export function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light",
  );
  const [save, setSave] = useState<SaveState>("saved");
  const [count, setCount] = useState(0);
  const [memos, setMemos] = useState<MemoState>("loaded");
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
      <Rail />
      <div className="main">
        <Titlebar title="바다가 보이는 방 — 집필" save={save} count={count} />
        <div className="workspace">
          <Editor onCount={setCount} onTyping={handleTyping} />
          <MemoPanel state={memos} />
        </div>
      </div>
      <Dock
        theme={theme}
        setTheme={setTheme}
        save={save}
        setSave={setSave}
        memos={memos}
        setMemos={setMemos}
      />
    </div>
  );
}
