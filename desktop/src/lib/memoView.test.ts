import { describe, expect, it } from "vitest";
import type { Memo } from "../../electron/db/types";
import { toInboxMemoView } from "./memoView";

const baseMemo: Memo = {
  id: "m1",
  body: "떠오른 생각",
  capturedAt: "2026-06-03T12:00:00.000Z",
  source: "app",
  linkedProjectIds: [],
  createdAt: "2026-06-03T12:00:00.000Z",
  updatedAt: "2026-06-03T12:00:00.000Z",
  deletedAt: null,
};

describe("toInboxMemoView", () => {
  const now = new Date("2026-06-03T12:00:00.000Z");

  it("should_map_body_and_relative_date_label", () => {
    const v = toInboxMemoView(baseMemo, new Map(), now);
    expect(v.body).toBe("떠오른 생각");
    expect(v.dateLabel).toBe("오늘");
  });

  it("should_have_empty_linked_projects_when_unlinked", () => {
    const v = toInboxMemoView(baseMemo, new Map(), now);
    expect(v.linkedProjects).toEqual([]);
  });

  it("should_resolve_linked_project_titles_from_map", () => {
    const m = { ...baseMemo, linkedProjectIds: ["p1"] };
    const v = toInboxMemoView(m, new Map([["p1", "바다가 보이는 방"]]), now);
    expect(v.linkedProjects).toEqual([{ id: "p1", title: "바다가 보이는 방" }]);
  });

  it("should_resolve_multiple_linked_projects", () => {
    const m = { ...baseMemo, linkedProjectIds: ["p1", "p2"] };
    const v = toInboxMemoView(
      m,
      new Map([
        ["p1", "작품 A"],
        ["p2", "작품 B"],
      ]),
      now,
    );
    expect(v.linkedProjects).toEqual([
      { id: "p1", title: "작품 A" },
      { id: "p2", title: "작품 B" },
    ]);
  });

  it("should_drop_linked_project_missing_from_map", () => {
    const m = { ...baseMemo, linkedProjectIds: ["p1", "gone"] };
    const v = toInboxMemoView(m, new Map([["p1", "작품 A"]]), now);
    expect(v.linkedProjects).toEqual([{ id: "p1", title: "작품 A" }]);
  });
});
