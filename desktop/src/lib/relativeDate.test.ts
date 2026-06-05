import { describe, expect, it } from "vitest";
import { formatRelativeDay } from "./relativeDate";

describe("formatRelativeDay", () => {
  // 정오 기준 — 타임존(±9h)으로도 날짜가 넘어가지 않아 결정적.
  const now = new Date("2026-06-03T12:00:00.000Z");

  it("should_return_today_for_same_day", () => {
    expect(formatRelativeDay("2026-06-03T12:00:00.000Z", now)).toBe("오늘");
  });

  it("should_return_yesterday_for_previous_day", () => {
    expect(formatRelativeDay("2026-06-02T12:00:00.000Z", now)).toBe("어제");
  });

  it("should_return_n_days_ago_for_two_to_six_days", () => {
    expect(formatRelativeDay("2026-05-31T12:00:00.000Z", now)).toBe("3일 전");
  });

  it("should_return_n_weeks_ago_for_seven_plus_days", () => {
    expect(formatRelativeDay("2026-05-27T12:00:00.000Z", now)).toBe("1주 전");
  });
});
