import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WriteStudioScreen, type Reentry } from "./WriteStudioScreen";
import type { Theme } from "../types";

// Editor 는 TipTap(브라우저 의존)이라 화면 단위 테스트에서는 가볍게 대체한다(시스템 경계).
vi.mock("../components/Editor", () => ({
  Editor: () => <div data-testid="editor" />,
}));

function renderScreen(over: Partial<Parameters<typeof WriteStudioScreen>[0]> = {}) {
  const props = {
    projectTitle: "바다가 보이는 방",
    editorKey: "doc1#1",
    initialBodyJson: "",
    save: "saved" as const,
    count: 1234,
    memos: [],
    memosLoading: false,
    onUnlinkMemo: vi.fn(),
    onSetPinMemo: vi.fn(),
    autoSave: true,
    onChange: vi.fn(),
    onSaveNow: vi.fn(),
    panelOpen: false,
    onTogglePanel: vi.fn(),
    reentry: null as Reentry | null,
    theme: "light" as Theme,
    onTheme: vi.fn(),
    onAutoSave: vi.fn(),
    onEndWork: vi.fn(),
    ...over,
  };
  render(<WriteStudioScreen {...props} />);
  return props;
}

describe("WriteStudioScreen", () => {
  it("should_always_show_save_state_and_count", () => {
    renderScreen({ save: "saved", count: 1234 });
    expect(screen.getByText(/저장됨/)).toBeInTheDocument();
    expect(screen.getByText(/1,234자/)).toBeInTheDocument();
  });

  it("should_keep_view_controls_in_a_collapsed_menu", () => {
    renderScreen();
    // 평소엔 보기 메뉴가 접혀 있어 줌·줄노트·테마 control 이 노출되지 않는다.
    expect(screen.queryByRole("group", { name: "작업공간 확대·축소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "테마" })).not.toBeInTheDocument();
    // 보기 버튼을 눌러야 control 이 펼쳐진다.
    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(screen.getByRole("group", { name: "작업공간 확대·축소" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "테마" })).toBeInTheDocument();
  });

  it("should_close_view_menu_when_drawer_button_clicked", () => {
    const onTogglePanel = vi.fn();
    renderScreen({ panelOpen: false, onTogglePanel });
    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(screen.getByRole("group", { name: "테마" })).toBeInTheDocument();
    // 곁쪽지 서랍을 열면 보기 팝오버는 닫힌다(상호 배타 — 두 오버레이 동시 노출 방지).
    fireEvent.click(screen.getByRole("button", { name: "곁쪽지 서랍" }));
    expect(onTogglePanel).toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "테마" })).not.toBeInTheDocument();
  });

  it("should_close_drawer_when_view_menu_opens", () => {
    const onTogglePanel = vi.fn();
    // 서랍이 열린 상태에서 보기 팝오버를 열면 서랍을 닫는다.
    renderScreen({ panelOpen: true, onTogglePanel });
    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(onTogglePanel).toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "테마" })).toBeInTheDocument();
  });

  it("should_show_reentry_card_with_last_sentence_next_scene_and_memo", () => {
    renderScreen({
      reentry: {
        lastSentence: "그녀는 창을 열었다.",
        nextScene: "주인공이 바다에 도착한다",
        memo: { body: "파도 소리를 묘사할 것" },
      },
    });
    expect(screen.getByText("그녀는 창을 열었다.")).toBeInTheDocument();
    expect(screen.getByText("주인공이 바다에 도착한다")).toBeInTheDocument();
    expect(screen.getByText("파도 소리를 묘사할 것")).toBeInTheDocument();
  });

  it("should_not_show_reentry_card_when_none", () => {
    renderScreen({ reentry: null });
    expect(screen.queryByLabelText("이어 쓰기 안내")).not.toBeInTheDocument();
  });

  it("should_dismiss_reentry_card_when_closed", () => {
    renderScreen({
      reentry: { lastSentence: "그녀는 창을 열었다.", nextScene: "", memo: null },
    });
    expect(screen.getByLabelText("이어 쓰기 안내")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이어 쓰기 안내 닫기" }));
    expect(screen.queryByLabelText("이어 쓰기 안내")).not.toBeInTheDocument();
  });

  // US2: 작업 종료 버튼 + 기록 메모 모달
  it("should_show_작업_종료_button", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "작업 종료" })).toBeInTheDocument();
  });

  it("should_open_modal_when_작업_종료_clicked", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "작업 종료" }));
    // 모달 다이얼로그가 표시된다
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // 텍스트 입력 영역이 있다
    expect(screen.getByPlaceholderText(/기록/)).toBeInTheDocument();
  });

  it("should_call_onEndWork_with_body_when_saved", () => {
    const onEndWork = vi.fn();
    renderScreen({ onEndWork });
    fireEvent.click(screen.getByRole("button", { name: "작업 종료" }));
    fireEvent.change(screen.getByPlaceholderText(/기록/), { target: { value: "오늘 3페이지 완료" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onEndWork).toHaveBeenCalledWith("오늘 3페이지 완료");
  });

  it("should_not_call_onEndWork_when_body_empty_and_saved", () => {
    const onEndWork = vi.fn();
    renderScreen({ onEndWork });
    fireEvent.click(screen.getByRole("button", { name: "작업 종료" }));
    // body 비어 있는 상태에서 저장 버튼은 비활성이어야 한다
    const saveBtn = screen.getByRole("button", { name: "저장" });
    expect(saveBtn).toBeDisabled();
    expect(onEndWork).not.toHaveBeenCalled();
  });

  it("should_close_modal_without_calling_onEndWork_when_cancelled", () => {
    const onEndWork = vi.fn();
    renderScreen({ onEndWork });
    fireEvent.click(screen.getByRole("button", { name: "작업 종료" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onEndWork).not.toHaveBeenCalled();
  });
});
