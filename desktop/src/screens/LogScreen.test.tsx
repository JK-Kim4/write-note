import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogCard as LogCardData, Project } from "../../electron/db/types";
import { LogScreen } from "./LogScreen";

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: "p1",
    title: "바다가 보이는 방",
    summary: "",
    tone: "",
    genre: "",
    targetLength: 50000,
    nextScene: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    ...over,
  };
}

function makeCard(over: Partial<LogCardData> = {}): LogCardData {
  return {
    project: makeProject(),
    wordCount: 31000,
    lastSentenceSource: "마지막 문장.",
    latestLog: null,
    totalDurationMs: 0,
    ...over,
  };
}

function stubLogs(cards: LogCardData[]) {
  vi.stubGlobal("electronAPI", {
    logs: {
      list: vi.fn().mockResolvedValue(cards),
      listByProject: vi.fn().mockResolvedValue([]),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogScreen", () => {
  it("should_show_empty_state_when_no_projects", async () => {
    stubLogs([]);
    render(<LogScreen panelOpen={false} onTogglePanel={() => {}} onOpenProject={() => {}} />);

    // FR-006: 작품 0개 → 빈 상태 안내
    expect(await screen.findByText(/작품을 만들면/)).toBeInTheDocument();
  });

  it("should_render_project_card_when_logs_list_returns_cards", async () => {
    stubLogs([makeCard()]);
    render(<LogScreen panelOpen={false} onTogglePanel={() => {}} onOpenProject={() => {}} />);

    // 카드 목록 — LogCard 가 작품 제목을 표시
    expect(await screen.findByText("바다가 보이는 방")).toBeInTheDocument();
  });
});
