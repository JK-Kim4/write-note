import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

// Editor 는 TipTap(브라우저 의존) — 시스템 경계로 더미 대체. 렌더 여부만 testid 로 확인한다.
vi.mock("./components/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

function stubApi() {
  const documentsUpdate = vi.fn();
  const projectsCreate = vi.fn();
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: {
      list: vi.fn(),
      listCards: vi.fn().mockResolvedValue([]),
      create: projectsCreate,
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documents: { getByProject: vi.fn().mockResolvedValue(null), update: documentsUpdate },
    memos: { create: vi.fn(), list: vi.fn(), listByProject: vi.fn().mockResolvedValue([]), pickReentry: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
  });
  return { documentsUpdate, projectsCreate };
}

afterEach(() => {
  vi.unstubAllGlobals();
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
