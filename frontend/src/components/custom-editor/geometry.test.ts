import { describe, it, expect } from "vitest";
import { pageGeometry, blockFont } from "./geometry";

// 기준 PageGeometry — A4, fontSizePx=16
const base = pageGeometry("A4", 16);

// 헬퍼: 소수점 허용 근사치 비교 (px 반올림 때문에 ±1)
const HEADING_MULTIPLIERS = { 1: 1.8, 2: 1.5, 3: 1.25 } as const;

describe("blockFont — T021", () => {
  it("paragraph 는 base fontSizePx/lineHeightPx 그대로", () => {
    const result = blockFont({ type: "paragraph" }, base);
    expect(result.fontSizePx).toBe(base.fontSizePx);
    expect(result.lineHeightPx).toBe(base.lineHeightPx);
  });

  it("heading level 1 — fontSizePx = round(base × 1.8), lineHeightPx = fontSizePx × 1.8", () => {
    const result = blockFont({ type: "heading", level: 1 }, base);
    const expectedFont = Math.round(base.fontSizePx * 1.8);
    expect(result.fontSizePx).toBe(expectedFont);
    expect(result.lineHeightPx).toBeCloseTo(expectedFont * 1.8, 5);
  });

  it("heading level 2 — fontSizePx = round(base × 1.5), lineHeightPx = fontSizePx × 1.8", () => {
    const result = blockFont({ type: "heading", level: 2 }, base);
    const expectedFont = Math.round(base.fontSizePx * 1.5);
    expect(result.fontSizePx).toBe(expectedFont);
    expect(result.lineHeightPx).toBeCloseTo(expectedFont * 1.8, 5);
  });

  it("heading level 3 — fontSizePx = round(base × 1.25), lineHeightPx = fontSizePx × 1.8", () => {
    const result = blockFont({ type: "heading", level: 3 }, base);
    const expectedFont = Math.round(base.fontSizePx * 1.25);
    expect(result.fontSizePx).toBe(expectedFont);
    expect(result.lineHeightPx).toBeCloseTo(expectedFont * 1.8, 5);
  });

  it("heading level 별 fontSizePx 가 내림차순 (level1 > level2 > level3 > paragraph)", () => {
    const h1 = blockFont({ type: "heading", level: 1 }, base);
    const h2 = blockFont({ type: "heading", level: 2 }, base);
    const h3 = blockFont({ type: "heading", level: 3 }, base);
    const p = blockFont({ type: "paragraph" }, base);
    expect(h1.fontSizePx).toBeGreaterThan(h2.fontSizePx);
    expect(h2.fontSizePx).toBeGreaterThan(h3.fontSizePx);
    expect(h3.fontSizePx).toBeGreaterThan(p.fontSizePx);
  });

  it("다른 base fontSizePx 에서도 배수 계산이 올바름 (fontSizePx=20)", () => {
    const base20 = pageGeometry("A4", 20);
    const h2 = blockFont({ type: "heading", level: 2 }, base20);
    expect(h2.fontSizePx).toBe(Math.round(20 * 1.5)); // 30
    expect(h2.lineHeightPx).toBeCloseTo(30 * 1.8, 5);
  });
});
