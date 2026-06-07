import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogCard as LogCardData } from "../../electron/db/types";
import type { Project } from "../../electron/db/types";
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
});
