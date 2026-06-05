import { describe, expect, it } from "vitest";
import type { Memo } from "../../electron/db/types";
import { toInboxMemoView } from "./memoView";

const baseMemo: Memo = {
  id: "m1",
  body: "떠오른 생각",
  capturedAt: "2026-06-03T12:00:00.000Z",
  source: "app",
  linkedProjectId: null,
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

  it("should_have_null_title_when_unlinked", () => {
    const v = toInboxMemoView(baseMemo, new Map(), now);
    expect(v.linkedProjectId).toBeNull();
    expect(v.linkedProjectTitle).toBeNull();
  });

  it("should_resolve_linked_project_title_from_map", () => {
    const m = { ...baseMemo, linkedProjectId: "p1" };
    const v = toInboxMemoView(m, new Map([["p1", "바다가 보이는 방"]]), now);
    expect(v.linkedProjectId).toBe("p1");
    expect(v.linkedProjectTitle).toBe("바다가 보이는 방");
  });

  it("should_null_title_when_linked_project_missing_from_map", () => {
    const m = { ...baseMemo, linkedProjectId: "gone" };
    const v = toInboxMemoView(m, new Map(), now);
    expect(v.linkedProjectId).toBe("gone");
    expect(v.linkedProjectTitle).toBeNull();
  });
});
