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
    linkedProjectId: null,
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
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

type Stub = {
  memosList?: ReturnType<typeof vi.fn>;
  projectsList?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  del?: ReturnType<typeof vi.fn>;
  restore?: ReturnType<typeof vi.fn>;
};

function renderScreen(stub: Stub = {}) {
  const memosList = stub.memosList ?? vi.fn().mockResolvedValue([]);
  const projectsList = stub.projectsList ?? vi.fn().mockResolvedValue([]);
  const create = stub.create ?? vi.fn().mockResolvedValue(makeMemo());
  const del = stub.del ?? vi.fn().mockResolvedValue(true);
  const restore = stub.restore ?? vi.fn().mockResolvedValue(makeMemo());
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { list: projectsList, create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: { create, list: memosList, link: vi.fn(), delete: del, restore },
    settings: { get: vi.fn(), set: vi.fn() },
  });
  render(<MemoInboxScreen refresh={0} panelOpen={false} onTogglePanel={vi.fn()} />);
  return { memosList, projectsList, create, del, restore };
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
    expect(await screen.findByText(/아직 메모가 없어요/)).toBeInTheDocument();
  });

  it("should_add_inline_memo_as_unlinked", async () => {
    const create = vi.fn().mockResolvedValue(makeMemo());
    const memosList = vi.fn().mockResolvedValueOnce([]).mockResolvedValue([makeMemo({ body: "새 메모" })]);
    renderScreen({ create, memosList });

    fireEvent.change(await screen.findByPlaceholderText("메모 한 줄 적기…"), { target: { value: "새 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ body: "새 메모", linkedProjectId: null }));
  });

  it("should_not_add_when_inline_input_empty", async () => {
    const create = vi.fn();
    renderScreen({ create });
    // 빈 입력이면 추가 버튼 비활성 → 저장 호출 없음
    expect(await screen.findByRole("button", { name: "추가" })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });

  it("should_show_linked_project_title", async () => {
    renderScreen({
      memosList: vi.fn().mockResolvedValue([makeMemo({ linkedProjectId: "p1" })]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "바다가 보이는 방" })]),
    });
    expect(await screen.findByText("바다가 보이는 방")).toBeInTheDocument();
  });

  it("should_show_unlinked_label_for_memo_without_project", async () => {
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ linkedProjectId: null })]) });
    expect(await screen.findByText("미연결")).toBeInTheDocument();
  });

  it("should_filter_to_unlinked_only", async () => {
    renderScreen({
      memosList: vi.fn().mockResolvedValue([
        makeMemo({ id: "linked", body: "연결된 메모", linkedProjectId: "p1" }),
        makeMemo({ id: "loose", body: "미연결 메모", linkedProjectId: null }),
      ]),
      projectsList: vi.fn().mockResolvedValue([makeProject({ id: "p1", title: "작품" })]),
    });
    expect(await screen.findByText("연결된 메모")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "미연결" }));

    expect(screen.queryByText("연결된 메모")).not.toBeInTheDocument();
    expect(screen.getByText("미연결 메모")).toBeInTheDocument();
  });

  it("should_delete_memo_optimistically_and_call_ipc", async () => {
    const del = vi.fn().mockResolvedValue(true);
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", body: "지울 메모" })]), del });

    expect(await screen.findByText("지울 메모")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "메모 삭제" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("m1"));
    expect(screen.queryByText("지울 메모")).not.toBeInTheDocument();
  });

  it("should_restore_memo_when_undo_clicked", async () => {
    const del = vi.fn().mockResolvedValue(true);
    const restore = vi.fn().mockResolvedValue(makeMemo({ id: "m1" }));
    renderScreen({ memosList: vi.fn().mockResolvedValue([makeMemo({ id: "m1", body: "되살릴 메모" })]), del, restore });

    fireEvent.click(await screen.findByRole("button", { name: "메모 삭제" }));
    fireEvent.click(await screen.findByRole("button", { name: "되돌리기" }));

    await waitFor(() => expect(restore).toHaveBeenCalledWith("m1"));
  });
});
