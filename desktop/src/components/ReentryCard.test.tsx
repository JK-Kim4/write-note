import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Reentry } from "../screens/WriteStudioScreen";
import { ReentryCard } from "./ReentryCard";

function makeReentry(over: Partial<Reentry> = {}): Reentry {
  return { lastSentence: "그는 천천히 노를 저었다.", nextScene: "", memo: null, ...over };
}

function renderReentry(reentry: Reentry) {
  return render(<ReentryCard reentry={reentry} onClose={vi.fn()} />);
}

describe("ReentryCard", () => {
  it("should_show_last_sentence_when_body_present", () => {
    renderReentry(makeReentry({ lastSentence: "그는 천천히 노를 저었다." }));
    expect(screen.getByText("그는 천천히 노를 저었다.")).toBeInTheDocument();
  });

  it("should_show_empty_placeholder_when_body_empty", () => {
    renderReentry(makeReentry({ lastSentence: null }));
    expect(screen.getByText("아직 첫 문장을 기다리는 중")).toBeInTheDocument();
  });

  it("should_show_next_scene_when_present", () => {
    renderReentry(makeReentry({ nextScene: "노인이 항구로 돌아온다" }));
    expect(screen.getByText("노인이 항구로 돌아온다")).toBeInTheDocument();
  });

  it("should_show_next_scene_empty_state_when_blank", () => {
    renderReentry(makeReentry({ nextScene: "" }));
    expect(screen.getByText("아직 정하지 않았어요")).toBeInTheDocument();
  });

  it("should_render_side_memo_when_present", () => {
    renderReentry(makeReentry({ memo: { body: "갈매기 묘사 더 넣기" } }));
    expect(screen.getByText("갈매기 묘사 더 넣기")).toBeInTheDocument();
  });

  it("should_not_render_side_memo_block_when_absent", () => {
    renderReentry(makeReentry({ memo: null }));
    expect(screen.queryByText("곁에 둘 쪽지")).not.toBeInTheDocument();
  });
});
