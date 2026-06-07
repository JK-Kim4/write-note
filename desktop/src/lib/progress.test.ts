import { describe, expect, it } from "vitest";
import { calcProgress, formatDuration } from "./progress";

describe("calcProgress", () => {
  it("should_return_null_when_targetLength_is_null", () => {
    expect(calcProgress(5000, null)).toBeNull();
  });

  it("should_return_null_when_targetLength_is_zero", () => {
    expect(calcProgress(0, 0)).toBeNull();
  });

  it("should_return_rounded_percent_for_normal_case", () => {
    // 31000 / 50000 = 0.62 → 62
    expect(calcProgress(31000, 50000)).toBe(62);
  });

  it("should_return_value_over_100_when_exceeds_target", () => {
    // 56000 / 50000 = 1.12 → 112
    expect(calcProgress(56000, 50000)).toBe(112);
  });

  it("should_return_0_when_wordCount_is_zero_and_target_set", () => {
    expect(calcProgress(0, 10000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("should_return_기록_없음_when_ms_is_zero", () => {
    expect(formatDuration(0)).toBe("기록 없음");
  });

  it("should_return_분_only_when_less_than_one_hour", () => {
    // 30분
    expect(formatDuration(30 * 60 * 1000)).toBe("30분");
  });

  it("should_return_시간_분_format_for_full_hours_and_minutes", () => {
    // 1시간 30분
    expect(formatDuration(90 * 60 * 1000)).toBe("1시간 30분");
  });

  it("should_return_시간_only_when_exact_hours_no_minutes", () => {
    // 2시간 정각
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2시간");
  });
});
