import { describe, it, expect } from "vitest";
import { pageCount, pageNumberTopsEm, LINE_PX } from "./pageLayout";

describe("pageCount", () => {
  // 측정 높이는 줄(LINE_PX) 단위로 구성. 보폭 = 29줄(한 장 26 + 간격 3).
  it("빈/짧은 본문은 최소 1장", () => {
    expect(pageCount(0, 1)).toBe(1);
    expect(pageCount(20 * LINE_PX, 1)).toBe(1);
  });

  it("꽉 찬 한 장(26줄)도 1장", () => {
    expect(pageCount(26 * LINE_PX, 1)).toBe(1);
  });

  it("둘째 장에 한 줄만 넘어가도 2장 (round 면 1로 적게 셈)", () => {
    // 1장(26줄) 채우고 간격(3줄) 뒤 둘째 장 첫 줄 → 측정 높이 ≈ (29+1)줄
    expect(pageCount((29 + 1) * LINE_PX, 1)).toBe(2);
  });

  it("셋째 장 중간이면 3장", () => {
    expect(pageCount((58 + 13) * LINE_PX, 1)).toBe(3);
  });

  it("줌이 곱해진 측정 높이를 줌으로 상쇄해 장수를 낸다", () => {
    // 줌 1.5, 둘째 장에 한 줄 → 측정 높이는 (29+1)줄 * 1.5
    expect(pageCount((29 + 1) * LINE_PX * 1.5, 1.5)).toBe(2);
  });

  it("LINE_PX 는 18px 본문 line-height 1.92 와 일치", () => {
    expect(LINE_PX).toBeCloseTo(34.56, 5);
  });
});

describe("pageNumberTopsEm", () => {
  it("장 수만큼, 보폭(29줄) 간격으로 위치를 낸다", () => {
    const tops = pageNumberTopsEm(3);
    expect(tops).toHaveLength(3);
    // 1장: (26-1.2)*1.92em, 이후 장마다 +29*1.92em
    expect(tops[0]).toBeCloseTo((26 - 1.2) * 1.92, 5);
    expect(tops[1]).toBeCloseTo((26 - 1.2 + 29) * 1.92, 5);
    expect(tops[2]).toBeCloseTo((26 - 1.2 + 58) * 1.92, 5);
  });

  it("0장 요청은 빈 배열", () => {
    expect(pageNumberTopsEm(0)).toEqual([]);
  });
});
