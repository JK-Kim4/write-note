import { fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// Editor 는 TipTap(브라우저 의존) — 시스템 경계로 더미 대체. 렌더 여부만 testid 로 확인한다.
vi.mock("./components/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

function stubApi() {
  const documentsUpdate = vi.fn();
  const projectsCreate = vi.fn();
  const sessionsStart = vi.fn().mockResolvedValue(undefined);
  const sessionsEnd = vi.fn().mockResolvedValue(undefined);
  const sessionsEndWithLog = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: {
      list: vi.fn().mockResolvedValue([]),
      listCards: vi.fn().mockResolvedValue([]),
      create: projectsCreate,
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documents: { getByProject: vi.fn().mockResolvedValue(null), update: documentsUpdate },
    memos: { create: vi.fn(), list: vi.fn().mockResolvedValue([]), listByProject: vi.fn().mockResolvedValue([]), pickReentry: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
    logs: { list: vi.fn().mockResolvedValue([]), listByProject: vi.fn().mockResolvedValue([]) },
    sessions: { start: sessionsStart, end: sessionsEnd, endWithLog: sessionsEndWithLog },
  });
  return { documentsUpdate, projectsCreate, sessionsStart, sessionsEnd, sessionsEndWithLog };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App 세션 생명주기", () => {
  it("should_not_call_sessions_start_when_entering_write_without_active_project", () => {
    const { sessionsStart } = stubApi();
    render(<App />);

    // 작품 선택 없이 집필 레일 클릭 → 빈 상태, sessions.start 미호출
    fireEvent.click(screen.getByRole("button", { name: /집필/ }));
    expect(sessionsStart).not.toHaveBeenCalled();
  });

  it("should_call_sessions_start_when_project_opened_and_screen_becomes_write", async () => {
    const { sessionsStart } = stubApi();
    // listCards 가 카드 1개를 반환하도록 설정 (stubApi 후 override)
    const mockProject = {
      id: "proj-1",
      title: "바다가 보이는 방",
      summary: "",
      tone: "",
      genre: "",
      targetLength: null,
      nextScene: "",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
      lastSentenceSource: "",
    };
    (window.electronAPI.projects.listCards as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);
    (window.electronAPI.documents.getByProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "doc1",
      bodyJson: "",
      plainText: "",
      wordCount: 0,
      projectId: "proj-1",
      title: "",
      createdAt: "",
      updatedAt: "",
    });
    (window.electronAPI.memos.pickReentry as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    render(<App />);

    // 작품 카드가 렌더될 때까지 대기
    const openBtn = await screen.findByRole("button", { name: /바다가 보이는 방 펼치기/ });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    expect(sessionsStart).toHaveBeenCalledWith("proj-1");
  });

  it("should_call_sessions_end_when_navigating_away_from_write_screen", async () => {
    const { sessionsEnd } = stubApi();
    const mockProject = {
      id: "proj-1",
      title: "바다가 보이는 방",
      summary: "",
      tone: "",
      genre: "",
      targetLength: null,
      nextScene: "",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
      lastSentenceSource: "",
    };
    (window.electronAPI.projects.listCards as ReturnType<typeof vi.fn>).mockResolvedValue([mockProject]);
    (window.electronAPI.documents.getByProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "doc1",
      bodyJson: "",
      plainText: "",
      wordCount: 0,
      projectId: "proj-1",
      title: "",
      createdAt: "",
      updatedAt: "",
    });
    (window.electronAPI.memos.pickReentry as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    render(<App />);

    // 작품 진입
    const openBtn = await screen.findByRole("button", { name: /바다가 보이는 방 펼치기/ });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    // 화면 전환 → sessions.end(proj-1) 호출 기대
    await act(async () => {
      // Rail 의 메모 화면 전환 버튼 (클래스: rail__item)
      const memoBtns = screen.getAllByRole("button", { name: /메모/ });
      const railMemoBtn = memoBtns.find((b) => b.classList.contains("rail__item"));
      if (railMemoBtn) fireEvent.click(railMemoBtn);
    });

    expect(sessionsEnd).toHaveBeenCalledWith("proj-1");
  });
});

describe("App 집필 진입 가드", () => {
  it("should_show_empty_state_not_editor_when_entering_write_without_active_project", async () => {
    stubApi();
    render(<App />);

    // 작품을 펼치지 않은 채 집필 rail 클릭
    fireEvent.click(screen.getByRole("button", { name: /집필/ }));

    // 빈 상태 안내가 뜨고, 편집기는 렌더되지 않는다
    expect(await screen.findByText(/아직 펼친 작품이 없/)).toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });

  it("should_offer_path_back_to_projects_from_write_empty_state", async () => {
    stubApi();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /집필/ }));

    // 빈 상태의 '작품으로 가기'를 누르면 작품 화면(작업실 입구)으로 돌아간다
    fireEvent.click(await screen.findByRole("button", { name: /작품으로 가기/ }));
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
  });
});
