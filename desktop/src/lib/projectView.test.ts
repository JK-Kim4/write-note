import { describe, expect, it } from "vitest";
import type { Project } from "../../electron/db/types";
import { toProjectCardView } from "./projectView";

const baseProject: Project = {
  id: "p1",
  title: "바다가 보이는 방",
  summary: "담담한 1인칭 회상",
  tone: "",
  genre: "",
  targetLength: null,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-03T12:00:00.000Z",
};

describe("toProjectCardView", () => {
  // 정오 기준 — 타임존(±9h)으로도 날짜가 넘어가지 않아 결정적.
  const now = new Date("2026-06-03T12:00:00.000Z");

  it("should_map_id_and_title_verbatim", () => {
    const v = toProjectCardView(baseProject, now);
    expect(v.id).toBe("p1");
    expect(v.title).toBe("바다가 보이는 방");
  });

  it("should_use_summary_as_preview_and_empty_when_blank", () => {
    expect(toProjectCardView(baseProject, now).summaryPreview).toBe("담담한 1인칭 회상");
    expect(toProjectCardView({ ...baseProject, summary: "" }, now).summaryPreview).toBe("");
  });

  it("should_label_same_day_as_today", () => {
    expect(toProjectCardView(baseProject, now).lastEditedLabel).toBe("오늘");
  });

  it("should_label_previous_day_as_yesterday", () => {
    const v = toProjectCardView({ ...baseProject, updatedAt: "2026-06-02T12:00:00.000Z" }, now);
    expect(v.lastEditedLabel).toBe("어제");
  });

  it("should_label_two_to_six_days_as_n_days_ago", () => {
    const v = toProjectCardView({ ...baseProject, updatedAt: "2026-05-31T12:00:00.000Z" }, now);
    expect(v.lastEditedLabel).toBe("3일 전");
  });

  it("should_label_seven_plus_days_as_n_weeks_ago", () => {
    const v = toProjectCardView({ ...baseProject, updatedAt: "2026-05-27T12:00:00.000Z" }, now);
    expect(v.lastEditedLabel).toBe("1주 전");
  });
});
