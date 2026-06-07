import { useCallback, useEffect, useRef, useState } from "react";
import { Rail } from "./components/Rail";
import { Dock } from "./components/Dock";
import { QuickCapture } from "./components/QuickCapture";
import { WriteStudioScreen } from "./screens/WriteStudioScreen";
import { WriteEmptyScreen } from "./screens/WriteEmptyScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { MemoInboxScreen } from "./screens/MemoInboxScreen";
import { LogScreen } from "./screens/LogScreen";
import { ContactScreen } from "./screens/ContactScreen";
import { toInboxMemoView } from "./lib/memoView";
import { lastSentence } from "./lib/lastSentence";
import type { Reentry } from "./screens/WriteStudioScreen";
import type { DocumentChange, InboxMemo, SaveState, Screen, Theme } from "./types";

const AUTOSAVE_DELAY_MS = 700;

function initialParam<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(window.location.search).get(key);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => initialParam("theme", ["light", "dark"], "light"));
  const [screen, setScreen] = useState<Screen>(() =>
    initialParam("screen", ["projects", "write", "memo", "log", "contact"], "projects"),
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
  const [activeProject, setActiveProject] = useState<{ id: string; title: string; nextScene: string } | null>(null);
  const [activeDoc, setActiveDoc] = useState<{
    id: string;
    bodyJson: string;
    plainText: string;
    editorKey: string;
  } | null>(null);
  // 집필 진입 직후 재진입 한 장(마지막 문장 + 다음 장면 + 곁쪽지). 작품 진입 시 1회 산출.
  const [reentry, setReentry] = useState<Reentry | null>(null);
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

  // 작품 선택 → 해당 작품의 기본 document 로드(본문 + 글자수 복원) + 재진입 한 장 산출.
  useEffect(() => {
    if (!activeProject) {
      setActiveDoc(null);
      setReentry(null);
      return;
    }
    let cancelled = false;
    const proj = activeProject;
    void Promise.all([
      window.electronAPI.documents.getByProject(proj.id),
      window.electronAPI.memos.pickReentry(proj.id),
    ]).then(([doc, memo]) => {
      if (cancelled || !doc) return;
      loadSeq.current += 1;
      setActiveDoc({
        id: doc.id,
        bodyJson: doc.bodyJson,
        plainText: doc.plainText,
        editorKey: `${doc.id}#${loadSeq.current}`,
      });
      setCount(doc.wordCount);
      setSave("saved");
      lastChange.current = null;
      setReentry({
        lastSentence: lastSentence(doc.plainText),
        nextScene: proj.nextScene,
        memo: memo ? { body: memo.body } : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  // 명시 종료("작업 종료" 버튼)가 endWithLog 로 세션을 이미 닫은 경우, 직후 화면 전환으로
  // 발화하는 effect cleanup 의 중복 sessions.end 를 1회 스킵한다(이중 종료 IPC 방지).
  const skipNextSessionEnd = useRef(false);

  // 세션 생명주기 — 집필 화면 진입 시 세션 시작, 이탈/작품 전환 시 세션 종료(30s 폐기).
  // cleanup 이 직전 pid 를 캡처하므로 stale closure 회피.
  // sessions API 가 없으면 no-op (테스트·환경 guard).
  useEffect(() => {
    if (screen !== "write" || !activeProject) return;
    const pid = activeProject.id;
    if (window.electronAPI?.sessions) {
      void window.electronAPI.sessions.start(pid);
    }
    return () => {
      if (skipNextSessionEnd.current) {
        skipNextSessionEnd.current = false;
        return;
      }
      if (window.electronAPI?.sessions) {
        void window.electronAPI.sessions.end(pid);
      }
    };
  }, [screen, activeProject]);

  // 현재 작품 연결 메모 로드(집필 패널). 캡처/연결 변경(memoRefresh) + 집필 화면 진입(screen) 시 재조회(FR-009).
  // screen 을 의존에 넣어, 메모 화면에서 연결을 바꾼 뒤 레일로 집필에 들어와도 패널이 최신 상태를 반영한다.
  useEffect(() => {
    if (!activeProject || screen !== "write") {
      if (!activeProject) setPanelMemos([]);
      return;
    }
    let cancelled = false;
    setPanelLoading(true);
    void window.electronAPI.memos.listByProject(activeProject.id).then((rows) => {
      if (cancelled) return;
      const now = new Date();
      // 패널은 현재 작품이 자명하므로 작품명 칩을 표시하지 않는다(연결 제목 맵 불요).
      // listByProject 는 ProjectMemo(= Memo + pinned) 이므로 곁쪽지 고정 상태를 view 에 얹는다.
      setPanelMemos(rows.map((m) => ({ ...toInboxMemoView(m, new Map(), now), pinned: m.pinned })));
      setPanelLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, memoRefresh, screen]);

  // 패널 내 빠른 해제 — 현재 작품과의 연결만 끊고 패널 즉시 갱신.
  const handlePanelUnlink = useCallback(
    (memoId: string) => {
      if (!activeProject) return;
      void window.electronAPI.memos.removeLink(memoId, activeProject.id).then(() => setMemoRefresh((n) => n + 1));
    },
    [activeProject],
  );

  // 곁쪽지 고정 토글 — backend 가 작품당 1개를 보장하므로, 다른 고정 해제도 재조회로 반영된다.
  const handleSetPin = useCallback(
    (memoId: string, pinned: boolean) => {
      if (!activeProject) return;
      void window.electronAPI.memos.setPin(memoId, activeProject.id, pinned).then(() => setMemoRefresh((n) => n + 1));
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
            setActiveProject({ id: p.id, title: p.title, nextScene: p.nextScene });
            setScreen("write");
          }}
        />
      )}
      {/* 펼친 작품이 없으면 편집기 대신 빈 상태 — 작품을 골라야 쓸 곳(document)이 생긴다. */}
      {screen === "write" && !activeProject && (
        <WriteEmptyScreen onGoToProjects={() => setScreen("projects")} />
      )}
      {screen === "write" && activeProject && (
        <WriteStudioScreen
          projectTitle={activeProject?.title}
          editorKey={activeDoc?.editorKey ?? "loading"}
          initialBodyJson={activeDoc?.bodyJson ?? ""}
          save={save}
          count={count}
          memos={panelMemos}
          memosLoading={panelLoading}
          onUnlinkMemo={handlePanelUnlink}
          onSetPinMemo={handleSetPin}
          autoSave={autoSave}
          onChange={handleChange}
          onSaveNow={saveNow}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
          reentry={reentry}
          theme={theme}
          onTheme={setTheme}
          onAutoSave={setAutoSave}
          onEndWork={(body) => {
            skipNextSessionEnd.current = true;
            void window.electronAPI.sessions
              .endWithLog(activeProject.id, body)
              .then(() => {
                setScreen("projects");
              })
              .catch(() => {
                // 종료 실패 시 스킵 플래그 복원 — 다음 정상 이탈에서 세션이 제대로 닫히도록.
                skipNextSessionEnd.current = false;
              });
          }}
        />
      )}
      {screen === "memo" && <MemoInboxScreen refresh={memoRefresh} />}
      {screen === "log" && <LogScreen panelOpen={panelOpen} onTogglePanel={togglePanel} />}
      {screen === "contact" && <ContactScreen />}

      {/* 집필 편집기는 보기 메뉴(WriteStudioScreen)가 테마·자동저장을 품으므로 전역 Dock 을 숨긴다(설정 진입점 중복 회피).
          단 집필 빈 상태(작품 미선택)는 보기 메뉴가 없으므로 Dock 을 보인다. */}
      {!(screen === "write" && activeProject) && (
        <Dock theme={theme} setTheme={setTheme} autoSave={autoSave} setAutoSave={setAutoSave} />
      )}
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
