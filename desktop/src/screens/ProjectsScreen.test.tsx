import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "../../electron/db/types";
import { ProjectsScreen } from "./ProjectsScreen";

function makeCard(over: Partial<ProjectCard> = {}): ProjectCard {
  const now = new Date().toISOString();
  return {
    id: "p1",
    title: "바다가 보이는 방",
    summary: "",
    tone: "",
    genre: "",
    targetLength: null,
    nextScene: "",
    createdAt: now,
    updatedAt: now,
    lastSentenceSource: "",
    ...over,
  };
}

type Stub = {
  listCards?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
};

function renderScreen(stub: Stub = {}) {
  const onOpenProject = vi.fn();
  const listCards = stub.listCards ?? vi.fn().mockResolvedValue([]);
  const create = stub.create ?? vi.fn();
  const update = stub.update ?? vi.fn().mockResolvedValue(null);
  const del = stub.delete ?? vi.fn().mockResolvedValue(true);
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { list: vi.fn(), listCards, create, get: vi.fn(), update, delete: del },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: { create: vi.fn(), list: vi.fn(), link: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn() },
  });
  render(<ProjectsScreen onOpenProject={onOpenProject} />);
  return { onOpenProject, listCards, create, update, delete: del };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsScreen", () => {
  it("should_show_welcome_not_form_when_no_projects", async () => {
    renderScreen({ listCards: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "첫 작품 시작하기" })).toBeInTheDocument();
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
  });

  it("should_open_create_form_from_welcome", async () => {
    renderScreen({ listCards: vi.fn().mockResolvedValue([]) });
    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
  });

  it("should_show_last_sentence_as_card_face", async () => {
    const listCards = vi.fn().mockResolvedValue([
      makeCard({ title: "겨울의 문장들", lastSentenceSource: "눈이 내렸다. 그는 코트를 여몄다." }),
    ]);
    renderScreen({ listCards });
    expect(await screen.findByText("그는 코트를 여몄다.")).toBeInTheDocument();
  });

  it("should_not_show_date_or_counter_metrics", async () => {
    const listCards = vi.fn().mockResolvedValue([
      makeCard({ title: "겨울의 문장들", lastSentenceSource: "눈이 내렸다." }),
    ]);
    renderScreen({ listCards });
    await screen.findByText("눈이 내렸다.");
    expect(screen.queryByText("오늘")).not.toBeInTheDocument();
    expect(screen.queryByText(/마지막 작업/)).not.toBeInTheDocument();
    expect(screen.queryByText(/개$/)).not.toBeInTheDocument();
  });

  it("should_save_next_scene_on_blur", async () => {
    const update = vi.fn().mockResolvedValue(null);
    renderScreen({
      listCards: vi.fn().mockResolvedValue([makeCard({ id: "p1", nextScene: "" })]),
      update,
    });
    const input = await screen.findByLabelText(/다음 장면/);
    fireEvent.change(input, { target: { value: "주인공이 바다에 도착한다" } });
    fireEvent.blur(input);
    await waitFor(() => expect(update).toHaveBeenCalledWith("p1", { nextScene: "주인공이 바다에 도착한다" }));
  });

  it("should_not_save_next_scene_when_unchanged", async () => {
    const update = vi.fn().mockResolvedValue(null);
    renderScreen({
      listCards: vi.fn().mockResolvedValue([makeCard({ id: "p1", nextScene: "이미 적은 장면" })]),
      update,
    });
    const input = await screen.findByLabelText(/다음 장면/);
    fireEvent.blur(input);
    expect(update).not.toHaveBeenCalled();
  });

  it("should_call_onOpenProject_with_clicked_project", async () => {
    const listCards = vi.fn().mockResolvedValue([makeCard({ id: "p1", title: "바다가 보이는 방" })]);
    const { onOpenProject } = renderScreen({ listCards });
    fireEvent.click(await screen.findByRole("button", { name: "바다가 보이는 방 펼치기" }));
    expect(onOpenProject).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", title: "바다가 보이는 방" }));
  });

  it("should_create_project_then_return_to_list", async () => {
    const created = makeCard({ id: "new", title: "이름 없는 막" });
    const listCards = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    const create = vi.fn().mockResolvedValue({ project: created, document: {} });
    renderScreen({ listCards, create });

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
    const created = makeCard({ id: "new", title: "이름 없는 막" });
    const listCards = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    const create = vi.fn().mockResolvedValue({ project: created, document: {} });
    renderScreen({ listCards, create });

    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "이름 없는 막" } });
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
    renderScreen({ listCards: vi.fn().mockResolvedValue([]) });
    fireEvent.click(await screen.findByRole("button", { name: "첫 작품 시작하기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
  });

  it("should_delete_project_after_confirm_then_reload", async () => {
    const card = makeCard({ id: "p1", title: "지울 작품" });
    const listCards = vi.fn().mockResolvedValueOnce([card]).mockResolvedValueOnce([]);
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ listCards, delete: del });

    fireEvent.click(await screen.findByRole("button", { name: "지울 작품 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
  });

  it("should_not_delete_when_confirm_cancelled", async () => {
    const card = makeCard({ id: "p1", title: "지울 작품" });
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ listCards: vi.fn().mockResolvedValue([card]), delete: del });

    fireEvent.click(await screen.findByRole("button", { name: "지울 작품 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByText("지울 작품")).toBeInTheDocument();
  });

  it("should_show_error_and_retry_when_list_fails", async () => {
    renderScreen({ listCards: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(await screen.findByText(/불러오지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
