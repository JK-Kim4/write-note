import { describe, it, expect } from "vitest";
import { computePageBreaks } from "./computePageBreaks";

// 블록(문단) 통째 분할 — 블록 중간을 자르지 않으므로 한글 음절/IME 조합이 쪼개질 일이 없다.
// spacerPx = (현재 페이지 남은 높이) + (장 사이 책상색 여백 gap).
describe("computePageBreaks", () => {
  it("블록이 없으면 분할도 없다", () => {
    expect(computePageBreaks([], 900, 20)).toEqual([]);
  });

  it("한 페이지에 다 들어가면 분할 없음", () => {
    expect(computePageBreaks([100, 200, 300], 900, 20)).toEqual([]);
  });

  it("페이지를 정확히 채운 뒤 다음 블록은 다음 장으로 넘긴다", () => {
    // page=300, [100,100,100,100] → 앞 3개로 300 채움, 4번째(index 3)가 넘침
    expect(computePageBreaks([100, 100, 100, 100], 300, 20)).toEqual([
      { beforeIndex: 3, spacerPx: 20 },
    ]);
  });

  it("페이지 중간에서 넘칠 때 남은 높이만큼 여백을 채워 다음 장 맨 위로 민다", () => {
    // page=300, [100,100,150] → 200 사용 후 150 블록이 넘침 → 남은 100 + gap 20 = 120
    expect(computePageBreaks([100, 100, 150], 300, 20)).toEqual([
      { beforeIndex: 2, spacerPx: 120 },
    ]);
  });

  it("여러 번 넘치면 분할도 여러 개", () => {
    expect(computePageBreaks([200, 200, 200], 300, 20)).toEqual([
      { beforeIndex: 1, spacerPx: 120 },
      { beforeIndex: 2, spacerPx: 120 },
    ]);
  });

  it("한 블록이 페이지보다 크면 그 장을 채우고 다음 블록은 새 장으로(여백=gap)", () => {
    expect(computePageBreaks([500, 100], 300, 20)).toEqual([
      { beforeIndex: 1, spacerPx: 20 },
    ]);
  });
});
