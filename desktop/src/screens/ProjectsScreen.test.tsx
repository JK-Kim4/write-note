import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../electron/db/types";
import { ProjectsScreen } from "./ProjectsScreen";

function makeProject(over: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: "p1",
    title: "바다가 보이는 방",
    summary: "",
    tone: "",
    genre: "",
    targetLength: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

type Stub = {
  list?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
};

// E 결정: 같은 파일 5회+ 반복되는 electronAPI stub 을 파일 로컬 헬퍼로 묶는다.
function renderScreen(stub: Stub = {}) {
  const onOpenProject = vi.fn();
  const list = stub.list ?? vi.fn().mockResolvedValue([]);
  const create = stub.create ?? vi.fn();
  const del = stub.delete ?? vi.fn().mockResolvedValue(true);
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { list, create, get: vi.fn(), update: vi.fn(), delete: del },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: { create: vi.fn(), list: vi.fn(), link: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn() },
  });
  render(<ProjectsScreen onOpenProject={onOpenProject} />);
  return { onOpenProject, list, create, delete: del };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsScreen", () => {
  it("should_show_welcome_not_form_when_no_projects", async () => {
    renderScreen({ list: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 작품 시작하기" })).toBeInTheDocument();
    // 빈 화면에는 생성 폼을 바로 노출하지 않는다(작품 없음/있음 화면 분리).
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
  });

  it("should_open_create_form_from_welcome", async () => {
    renderScreen({ list: vi.fn().mockResolvedValue([]) });
    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
  });

  it("should_render_project_cards_from_list", async () => {
    const list = vi.fn().mockResolvedValue([makeProject({ title: "겨울의 문장들" })]);
    renderScreen({ list });
    expect(await screen.findByText("겨울의 문장들")).toBeInTheDocument();
    expect(screen.getByText("오늘")).toBeInTheDocument();
  });

  it("should_create_project_with_title_and_summary_then_return_to_list", async () => {
    const created = makeProject({ id: "new", title: "이름 없는 막" });
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    const create = vi.fn().mockResolvedValue({ project: created, document: {} });
    renderScreen({ list, create });

    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "이름 없는 막" } });
    fireEvent.change(screen.getByLabelText(/시놉시스/), { target: { value: "어느 여름" } });
    fireEvent.click(screen.getByRole("button", { name: "작품 만들기" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: "이름 없는 막",
        summary: "어느 여름",
        tone: "",
        genre: "",
        targetLength: null,
      }),
    );
    expect(await screen.findByText("이름 없는 막")).toBeInTheDocument();
  });

  it("should_include_genre_tone_target_when_additional_info_filled", async () => {
    const created = makeProject({ id: "new", title: "이름 없는 막" });
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    const create = vi.fn().mockResolvedValue({ project: created, document: {} });
    renderScreen({ list, create });

    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "이름 없는 막" } });
    // 접힌 추가 정보를 펼쳐야 필드가 보인다.
    expect(screen.queryByLabelText("장르")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /추가 정보/ }));
    fireEvent.change(screen.getByLabelText("장르"), { target: { value: "단편소설" } });
    fireEvent.change(screen.getByLabelText(/목표 분량/), { target: { value: "8000" } });
    fireEvent.change(screen.getByLabelText("톤"), { target: { value: "담담하게" } });
    fireEvent.click(screen.getByRole("button", { name: "작품 만들기" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        title: "이름 없는 막",
        summary: "",
        tone: "담담하게",
        genre: "단편소설",
        targetLength: 8000,
      }),
    );
  });

  it("should_cancel_create_and_return_to_welcome", async () => {
    renderScreen({ list: vi.fn().mockResolvedValue([]) });
    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
  });

  it("should_call_onOpenProject_with_clicked_project", async () => {
    const list = vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "바다가 보이는 방" })]);
    const { onOpenProject } = renderScreen({ list });

    fireEvent.click(await screen.findByRole("button", { name: "바다가 보이는 방 열기" }));
    expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", title: "바다가 보이는 방" }));
  });

  it("should_delete_project_after_confirm_then_reload", async () => {
    const proj = makeProject({ id: "p1", title: "지울 작품" });
    const list = vi.fn().mockResolvedValueOnce([proj]).mockResolvedValueOnce([]);
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ list, delete: del });

    fireEvent.click(await screen.findByRole("button", { name: "지울 작품 삭제" }));
    // 확인 모달이 뜨고, 확정해야 실제 삭제된다(되돌릴 수 없는 작업).
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("p1"));
    // 삭제 후 목록 재조회 → 0개 → 작업실 입구.
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
  });

  it("should_not_delete_when_confirm_cancelled", async () => {
    const proj = makeProject({ id: "p1", title: "지울 작품" });
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ list: vi.fn().mockResolvedValue([proj]), delete: del });

    fireEvent.click(await screen.findByRole("button", { name: "지울 작품 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("지울 작품")).toBeInTheDocument();
  });

  it("should_show_error_and_retry_when_list_fails", async () => {
    renderScreen({ list: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(await screen.findByText(/불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
