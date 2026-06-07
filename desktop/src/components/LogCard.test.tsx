import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogCard as LogCardData, Project, ProjectLog } from "../../electron/db/types";
import { LogCard } from "./LogCard";

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: "p1",
    title: "테스트 작품",
    summary: "",
    tone: "",
    genre: "",
    targetLength: 50000,
    nextScene: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

function makeCard(over: Partial<LogCardData> = {}): LogCardData {
  return {
    project: makeProject(),
    wordCount: 31000,
    lastSentenceSource: "첫 문장. 마지막 문장.",
    latestLog: null,
    totalDurationMs: 0,
    ...over,
  };
}

function makeProjectLog(over: Partial<ProjectLog> = {}): ProjectLog {
  return {
    id: "log1",
    projectId: "p1",
    body: "오늘 3페이지 완료",
    createdAt: "2026-06-08T10:00:00.000Z",
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LogCard", () => {
  it("should_show_project_title", () => {
    render(<LogCard card={makeCard()} now={new Date("2026-06-08T00:00:00.000Z")} />);
    expect(screen.getByText("테스트 작품")).toBeInTheDocument();
  });

  it("should_show_progress_percent_when_targetLength_set", () => {
    render(<LogCard card={makeCard({ wordCount: 31000 })} now={new Date("2026-06-08T00:00:00.000Z")} />);
    // 31000 / 50000 = 62%
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("should_show_목표_미설정_when_targetLength_null", () => {
    render(
      <LogCard
        card={makeCard({ project: makeProject({ targetLength: null }) })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    expect(screen.getByText("목표 미설정")).toBeInTheDocument();
  });

  it("should_not_show_percent_when_목표_미설정", () => {
    render(
      <LogCard
        card={makeCard({ project: makeProject({ targetLength: null }) })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("should_show_last_sentence_derived_from_lastSentenceSource", () => {
    render(
      <LogCard
        card={makeCard({ lastSentenceSource: "첫 문장. 마지막 문장." })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    expect(screen.getByText("마지막 문장.")).toBeInTheDocument();
  });

  it("should_not_show_last_sentence_when_body_empty", () => {
    render(
      <LogCard card={makeCard({ lastSentenceSource: "" })} now={new Date("2026-06-08T00:00:00.000Z")} />,
    );
    // 빈 본문이면 마지막 문장 미표시
    expect(screen.queryByRole("paragraph", { name: /마지막/ })).not.toBeInTheDocument();
  });

  it("should_show_relative_date_for_updatedAt", () => {
    render(
      <LogCard
        card={makeCard({ project: makeProject({ updatedAt: "2026-06-07T00:00:00.000Z" }) })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    // 1일 전 = "어제"
    expect(screen.getByText("어제")).toBeInTheDocument();
  });

  it("should_show_기록_없음_when_totalDurationMs_zero", () => {
    render(<LogCard card={makeCard({ totalDurationMs: 0 })} now={new Date("2026-06-08T00:00:00.000Z")} />);
    expect(screen.getByText("기록 없음")).toBeInTheDocument();
  });

  // US2: 최신 기록 1줄 + 아코디언 토글
  it("should_show_latest_log_body_when_latestLog_present", () => {
    render(
      <LogCard
        card={makeCard({ latestLog: makeProjectLog({ body: "오늘 집필 세션 완료" }) })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    expect(screen.getByText("오늘 집필 세션 완료")).toBeInTheDocument();
  });

  it("should_show_아직_기록_없음_text_when_latestLog_null", () => {
    render(
      <LogCard card={makeCard({ latestLog: null })} now={new Date("2026-06-08T00:00:00.000Z")} />,
    );
    expect(screen.getByText("아직 기록 없음")).toBeInTheDocument();
  });

  it("should_show_accordion_toggle_button", () => {
    render(
      <LogCard
        card={makeCard({ latestLog: makeProjectLog() })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );
    expect(screen.getByRole("button", { name: /기록 펼치기|기록 접기/ })).toBeInTheDocument();
  });

  it("should_call_listByProject_and_show_all_logs_when_accordion_opened", async () => {
    const mockLogs: ProjectLog[] = [
      { id: "log2", projectId: "p1", body: "두 번째 기록", createdAt: "2026-06-08T11:00:00.000Z" },
      { id: "log1", projectId: "p1", body: "첫 번째 기록", createdAt: "2026-06-07T10:00:00.000Z" },
    ];
    const listByProject = vi.fn().mockResolvedValue(mockLogs);
    vi.stubGlobal("electronAPI", {
      logs: { listByProject },
    });

    render(
      <LogCard
        card={makeCard({ latestLog: makeProjectLog() })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: /기록 펼치기/ });
    fireEvent.click(toggleBtn);

    expect(listByProject).toHaveBeenCalledWith("p1");
    expect(await screen.findByText("두 번째 기록")).toBeInTheDocument();
    expect(screen.getByText("첫 번째 기록")).toBeInTheDocument();
  });

  it("should_hide_log_list_when_accordion_closed_again", async () => {
    const mockLogs: ProjectLog[] = [
      { id: "log1", projectId: "p1", body: "기록 본문", createdAt: "2026-06-07T10:00:00.000Z" },
    ];
    vi.stubGlobal("electronAPI", {
      logs: { listByProject: vi.fn().mockResolvedValue(mockLogs) },
    });

    render(
      <LogCard
        card={makeCard({ latestLog: makeProjectLog() })}
        now={new Date("2026-06-08T00:00:00.000Z")}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: /기록 펼치기/ });
    fireEvent.click(toggleBtn); // 펼침
    await waitFor(() => expect(screen.getByText("기록 본문")).toBeInTheDocument());

    const closeBtn = screen.getByRole("button", { name: /기록 접기/ });
    fireEvent.click(closeBtn); // 접음

    expect(screen.queryByText("기록 본문")).not.toBeInTheDocument();
  });
});
