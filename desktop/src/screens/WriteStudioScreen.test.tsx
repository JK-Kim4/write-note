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
    autoSave: true,
    onChange: vi.fn(),
    onSaveNow: vi.fn(),
    panelOpen: false,
    onTogglePanel: vi.fn(),
    reentry: null as Reentry | null,
    theme: "light" as Theme,
    onTheme: vi.fn(),
    onAutoSave: vi.fn(),
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
});
