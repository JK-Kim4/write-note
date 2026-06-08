import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCardView } from "../lib/projectView";
import { ProjectWallCard } from "./ProjectWallCard";

function makeCard(over: Partial<ProjectCardView> = {}): ProjectCardView {
  return { id: "p1", title: "바다 소설", lastSentence: "그는 천천히 노를 저었다.", nextScene: "", ...over };
}

function renderCard(card: ProjectCardView) {
  return render(
    <ProjectWallCard card={card} index={0} onOpen={vi.fn()} onSaveNextScene={vi.fn()} onDelete={vi.fn()} />,
  );
}

describe("ProjectWallCard", () => {
  it("should_show_last_sentence_as_face_when_body_present", () => {
    renderCard(makeCard({ lastSentence: "그는 천천히 노를 저었다." }));
    expect(screen.getByText("그는 천천히 노를 저었다.")).toBeInTheDocument();
  });

  it("should_show_empty_placeholder_when_body_empty", () => {
    renderCard(makeCard({ lastSentence: null }));
    expect(screen.getByText("아직 첫 문장을 기다리는 중")).toBeInTheDocument();
  });

  it("should_not_show_empty_placeholder_when_body_present", () => {
    renderCard(makeCard({ lastSentence: "한 문장이라도 있으면" }));
    expect(screen.queryByText("아직 첫 문장을 기다리는 중")).not.toBeInTheDocument();
  });

  it("should_always_render_title_under_the_face", () => {
    renderCard(makeCard({ title: "바다 소설", lastSentence: null }));
    expect(screen.getByText("바다 소설")).toBeInTheDocument();
  });
});
