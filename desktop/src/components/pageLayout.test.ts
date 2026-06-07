import { describe, it, expect } from "vitest";
import { pageCount, globalLineAt, LINE_PX, SHEET_H_PX, PAGE_STRIDE_PX } from "./pageLayout";

describe("pageCount", () => {
  // 측정 높이는 줄(LINE_PX) 단위로 구성. 보폭 = 30줄(종이 28 + 책상 간격 2). 본문 26줄.
  it("빈/짧은 본문은 최소 1장", () => {
    expect(pageCount(0, 1)).toBe(1);
    expect(pageCount(20 * LINE_PX, 1)).toBe(1);
  });

  it("꽉 찬 한 장(본문 26줄)도 1장", () => {
    expect(pageCount(26 * LINE_PX, 1)).toBe(1);
  });

  it("둘째 장에 한 줄만 넘어가도 2장 (round 면 1로 적게 셈)", () => {
    // 1장 채우고 책상 간격 뒤 둘째 장 첫 줄 → 측정 높이 ≈ (보폭 30 + 1)줄
    expect(pageCount((30 + 1) * LINE_PX, 1)).toBe(2);
  });

  it("셋째 장 중간이면 3장", () => {
    expect(pageCount((60 + 13) * LINE_PX, 1)).toBe(3);
  });

  it("줌이 곱해진 측정 높이를 줌으로 상쇄해 장수를 낸다", () => {
    // 줌 1.5, 둘째 장에 한 줄 → 측정 높이는 (30+1)줄 * 1.5
    expect(pageCount((30 + 1) * LINE_PX * 1.5, 1.5)).toBe(2);
  });

  it("LINE_PX 는 18px 본문 line-height 1.92 와 일치", () => {
    expect(LINE_PX).toBeCloseTo(34.56, 5);
  });

  it("종이 박스(28줄) + 책상 간격(2줄) = 보폭(30줄)", () => {
    expect(SHEET_H_PX).toBeCloseTo(LINE_PX * 28, 5);
    expect(PAGE_STRIDE_PX - SHEET_H_PX).toBeCloseTo(LINE_PX * 2, 5);
  });
});

describe("globalLineAt", () => {
  it("첫 장 안의 줄을 그대로 센다", () => {
    expect(globalLineAt(0)).toBe(0);
    expect(globalLineAt(3.4)).toBe(3);
    expect(globalLineAt(25.9)).toBe(25);
  });

  it("간격(26~30줄) 클릭은 그 장 마지막 줄(25)로 스냅", () => {
    expect(globalLineAt(27)).toBe(25);
    expect(globalLineAt(29.9)).toBe(25);
  });

  it("둘째 장은 보폭 30 뒤부터 = 전역 26줄째", () => {
    expect(globalLineAt(30)).toBe(26);
    expect(globalLineAt(31.5)).toBe(27);
    expect(globalLineAt(30 + 25.5)).toBe(51);
  });

  it("음수/0 은 첫 줄", () => {
    expect(globalLineAt(-5)).toBe(0);
  });
});
