import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Memo, Project } from "../../electron/db/types";
import { MemoInboxScreen } from "./MemoInboxScreen";

function makeMemo(over: Partial<Memo> = {}): Memo {
  const now = new Date().toISOString();
  return {
    id: "m1",
    body: "떠오른 생각",
    capturedAt: now,
    source: "app",
    linkedProjectIds: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  };
}

function makeProject(over: Partial<Project> = {}): Project {
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
    ...over,
  };
}

type Stub = {
  memosList?: ReturnType<typeof vi.fn>;
  projectsList?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  addLink?: ReturnType<typeof vi.fn>;
  removeLink?: ReturnType<typeof vi.fn>;
  del?: ReturnType<typeof vi.fn>;
  restore?: ReturnType<typeof vi.fn>;
};

function renderScreen(stub: Stub = {}) {
  const memosList = stub.memosList ?? vi.fn().mockResolvedValue([]);
  const projectsList = stub.projectsList ?? vi.fn().mockResolvedValue([]);
  const create = stub.create ?? vi.fn().mockResolvedValue(makeMemo());
  const addLink = stub.addLink ?? vi.fn().mockResolvedValue(undefined);
  const removeLink = stub.removeLink ?? vi.fn().mockResolvedValue(undefined);
  const del = stub.del ?? vi.fn().mockResolvedValue(true);
  const restore = stub.restore ?? vi.fn().mockResolvedValue(makeMemo());
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { list: projectsList, create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: { create, list: memosList, listByProject: vi.fn(), addLink, removeLink, delete: del, restore },
    settings: { get: vi.fn(), set: vi.fn() },
  });
  render(<MemoInboxScreen refresh={0} />);
  return { memosList, projectsList, create, addLink, removeLink, del, restore };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MemoInboxScreen", () => {
  it("should_render_memos_from_list", async () => {
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ body: "바다를 처음 본 날" })]) });
    expect(await screen.findByText("바다를 처음 본 날")).toBeInTheDocument();
  });

  it("should_show_empty_message_when_no_memos", async () => {
    renderScreen();
    expect(await screen.findByText(/아직 쪽지가 없어요/)).toBeInTheDocument();
  });

  it("should_add_inline_memo_as_unlinked", async () => {
    const create = vi.fn().mockResolvedValue(makeMemo());
    const memosList = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([makeMemo({ body: "새 메모" })]);
    renderScreen({ create, memosList });

    fireEvent.change(await screen.findByPlaceholderText("쪽지 한 줄 적기…"), { target: { value: "새 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ body: "새 메모", linkProjectId: null }));
  });

  it("should_not_add_when_inline_input_empty", async () => {
    const create = vi.fn();
    renderScreen({ create });
    expect(await screen.findByRole("button", { name: "추가" })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });

  it("should_show_linked_project_name_tab", async () => {
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ linkedProjectIds: ["p1"] })]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "바다가 보이는 방" })]),
    });
    const tab = await screen.findByTitle("붙인 작품");
    expect(tab).toHaveTextContent("바다가 보이는 방");
  });

  it("should_show_attach_entry_for_unlinked_memo", async () => {
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ linkedProjectIds: [] })]) });
    expect(await screen.findByRole("button", { name: "작품에 붙이기" })).toBeInTheDocument();
  });

  it("should_not_render_stats_panel", async () => {
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo()]) });
    await screen.findByText("떠오른 생각");
    expect(screen.queryByText("전체 메모")).not.toBeInTheDocument();
    expect(screen.queryByText("미연결")).not.toBeInTheDocument();
  });

  it("should_not_render_count_phrase", async () => {
    // FR-012/SC-003 — 개수 카운터 언어("쪽지 N장")는 관리 도구 톤 회귀라 표시하지 않는다.
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ body: "첫 쪽지" }), makeMemo({ id: "m2", body: "둘째 쪽지" })]),
    });
    await screen.findByText("첫 쪽지");
    expect(screen.queryByText(/쪽지 \d+장/)).not.toBeInTheDocument();
  });

  it("should_not_render_all_unlinked_segment_filter", async () => {
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo()]) });
    await screen.findByText("떠오른 생각");
    expect(screen.queryByRole("button", { name: "전체" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "미연결" })).not.toBeInTheDocument();
  });

  it("should_render_multiple_linked_tabs", async () => {
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ linkedProjectIds: ["p1", "p2"] })]),
      projectsList: vi.fn().mockResolvedValue([
        makeProject({ id: "p1", title: "작품 A" }),
        makeProject({ id: "p2", title: "작품 B" }),
      ]),
    });
    const tabs = await screen.findAllByTitle("붙인 작품");
    const tabText = tabs.map((t) => t.textContent);
    expect(tabText).toContain("작품 A✕");
    expect(tabText).toContain("작품 B✕");
  });

  it("should_sift_to_a_project_when_chosen", async () => {
    renderScreen({
      memosList: vi.fn().mockResolvedValue([
        makeMemo({ id: "linked", body: "연결된 메모", linkedProjectIds: ["p1"] }),
        makeMemo({ id: "loose", body: "다른 메모", linkedProjectIds: [] }),
      ]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품" })]),
    });
    expect(await screen.findByText("연결된 메모")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "작품" }));

    expect(screen.getByText("연결된 메모")).toBeInTheDocument();
    expect(screen.queryByText("다른 메모")).not.toBeInTheDocument();
  });

  it("should_link_memo_to_project_via_popover", async () => {
    const addLink = vi.fn().mockResolvedValue(undefined);
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", linkedProjectIds: [] })]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품 A" })]),
      addLink,
    });

    fireEvent.click(await screen.findByRole("button", { name: "작품에 붙이기" }));
    fireEvent.click(await screen.findByRole("button", { name: /작품 A/ }));

    await waitFor(() => expect(addLink).toHaveBeenCalledWith("m1", "p1"));
  });

  it("should_link_optimistically_and_show_tab_without_reload", async () => {
    const addLink = vi.fn().mockResolvedValue(undefined);
    // 재조회(list)가 연결을 반영하지 않아도(항상 미연결 반환) optimistic 으로 이름표가 즉시 보여야 한다.
    // 동시에 성공 경로에서 재조회로 이름표를 덮어쓰지 않음을 강제(memosList 초기 1회만).
    const memosList = vi.fn().mockResolvedValue([makeMemo({ id: "m1", linkedProjectIds: [] })]);
    renderScreen({
      memosList,
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품 A" })]),
      addLink,
    });

    fireEvent.click(await screen.findByRole("button", { name: "작품에 붙이기" }));
    fireEvent.click(await screen.findByRole("button", { name: /작품 A/ }));

    await waitFor(() => expect(addLink).toHaveBeenCalledWith("m1", "p1"));
    const tab = await screen.findByTitle("붙인 작품");
    expect(tab).toHaveTextContent("작품 A");
    expect(memosList).toHaveBeenCalledTimes(1);
  });

  it("should_unlink_memo_via_tab", async () => {
    const removeLink = vi.fn().mockResolvedValue(undefined);
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", linkedProjectIds: ["p1"] })]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품 A" })]),
      removeLink,
    });

    fireEvent.click(await screen.findByRole("button", { name: "작품 A 연결 해제" }));

    await waitFor(() => expect(removeLink).toHaveBeenCalledWith("m1", "p1"));
  });

  it("should_unlink_optimistically_and_remove_tab_without_reload", async () => {
    const removeLink = vi.fn().mockResolvedValue(undefined);
    // 재조회(list)가 해제를 반영하지 않아도(항상 연결 반환) optimistic 으로 이름표가 즉시 사라져야 한다.
    const memosList = vi.fn().mockResolvedValue([makeMemo({ id: "m1", linkedProjectIds: ["p1"] })]);
    renderScreen({
      memosList,
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품 A" })]),
      removeLink,
    });

    fireEvent.click(await screen.findByRole("button", { name: "작품 A 연결 해제" }));

    await waitFor(() => expect(removeLink).toHaveBeenCalledWith("m1", "p1"));
    await waitFor(() => expect(screen.queryByText("작품 A")).not.toBeInTheDocument());
    expect(memosList).toHaveBeenCalledTimes(1);
  });

  it("should_unlink_only_selected_project_when_memo_has_multiple", async () => {
    const removeLink = vi.fn().mockResolvedValue(undefined);
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", linkedProjectIds: ["p1", "p2"] })]),
      projectsList: vi.fn().mockResolvedValue([
        makeProject({ id: "p1", title: "작품 A" }),
        makeProject({ id: "p2", title: "작품 B" }),
      ]),
      removeLink,
    });

    fireEvent.click(await screen.findByRole("button", { name: "작품 A 연결 해제" }));

    await waitFor(() => expect(removeLink).toHaveBeenCalledWith("m1", "p1"));
    expect(removeLink).not.toHaveBeenCalledWith("m1", "p2");
  });

  it("should_delete_memo_optimistically_and_call_ipc", async () => {
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", body: "지울 메모" })]), del });

    expect(await screen.findByText("지울 메모")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "쪽지 버리기" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("m1"));
    expect(screen.queryByText("지울 메모")).not.toBeInTheDocument();
  });

  it("should_restore_memo_when_undo_clicked", async () => {
    const del = vi.fn().mockResolvedValue(true);
    const restore = vi.fn().mockResolvedValue(makeMemo({ id: "m1" }));
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", body: "되살릴 메모" })]), del, restore });

    fireEvent.click(await screen.findByRole("button", { name: "쪽지 버리기" }));
    fireEvent.click(await screen.findByRole("button", { name: "되돌리기" }));

    await waitFor(() => expect(restore).toHaveBeenCalledWith("m1"));
  });
});
