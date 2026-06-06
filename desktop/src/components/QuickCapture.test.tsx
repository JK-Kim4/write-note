import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickCapture } from "./QuickCapture";

type Stub = { create?: ReturnType<typeof vi.fn> };

function stubApi(stub: Stub = {}) {
  const create = stub.create ?? vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("electronAPI", {
    platform: "darwin",
    projects: { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    documents: { getByProject: vi.fn(), update: vi.fn() },
    memos: {
      create,
      list: vi.fn(),
      listByProject: vi.fn(),
      addLink: vi.fn(),
      removeLink: vi.fn(),
      delete: vi.fn(),
      restore: vi.fn(),
    },
    settings: { get: vi.fn(), set: vi.fn() },
  });
  return { create };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("QuickCapture", () => {
  it("마운트 시 textarea 에 포커스를 둔다", () => {
    stubApi();
    render(<QuickCapture activeProjectId={null} onClose={vi.fn()} onCaptured={vi.fn()} />);
    expect(screen.getByPlaceholderText("떠오른 생각을 적어두세요…")).toHaveFocus();
  });

  it("현재 작품이 있으면 그 작품에 연결해 저장한다", async () => {
    const { create } = stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId="p1" onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "착상" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ body: "착상", linkProjectId: "p1" }));
  });

  it("내용이 비어 있으면 Escape 로 즉시 닫힌다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("내용이 있으면 Escape 로 닫혀 초안이 유실되지 않는다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "지키고 싶은 한 줄" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("지키고 싶은 한 줄")).toBeInTheDocument();
  });

  it("내용이 있으면 backdrop 클릭으로 닫히지 않는다", () => {
    stubApi();
    const onClose = vi.fn();
    const { container } = render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "초안" } });
    const backdrop = container.querySelector(".modal-backdrop");
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("닫힐 때 직전 포커스 위치로 복귀한다", () => {
    stubApi();
    const trigger = document.createElement("button");
    trigger.textContent = "잉크 한 방울";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const onClose = vi.fn();
    const { unmount } = render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    expect(screen.getByPlaceholderText("떠오른 생각을 적어두세요…")).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
  });

  it("Tab 이 마지막 요소에서 첫 요소로 순환한다(focus trap)", () => {
    stubApi();
    render(<QuickCapture activeProjectId={null} onClose={vi.fn()} onCaptured={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("떠오른 생각을 적어두세요…");
    // 내용을 채워 저장 버튼이 활성(=마지막 focusable)이 되게 한다.
    fireEvent.change(textarea, { target: { value: "한 줄" } });
    const save = screen.getByRole("button", { name: "저장" });

    save.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(textarea).toHaveFocus();
  });

  it("Shift+Tab 이 첫 요소에서 마지막 요소로 순환한다", () => {
    stubApi();
    render(<QuickCapture activeProjectId={null} onClose={vi.fn()} onCaptured={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("떠오른 생각을 적어두세요…");
    fireEvent.change(textarea, { target: { value: "한 줄" } });
    const save = screen.getByRole("button", { name: "저장" });

    textarea.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
  });

  it("내용이 비어 있으면 취소로 즉시 닫힌다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("내용이 있으면 취소 시 확인을 거쳐 바로 닫히지 않는다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "지킬 한 줄" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "버리기" })).toBeInTheDocument();
  });

  it("취소 확인에서 버리기를 누르면 닫힌다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "버릴 초안" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "버리기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("취소 확인에서 계속 쓰기를 누르면 닫히지 않고 초안이 유지된다", () => {
    stubApi();
    const onClose = vi.fn();
    render(<QuickCapture activeProjectId={null} onClose={onClose} onCaptured={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("떠오른 생각을 적어두세요…"), { target: { value: "이어 쓸 초안" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "계속 쓰기" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("이어 쓸 초안")).toBeInTheDocument();
  });
});
