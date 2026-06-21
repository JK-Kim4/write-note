import { describe, it, expect } from "vitest";
import {
  pageGeometry,
  mobilePageGeometry,
  blockFont,
  recommendedFontPx,
  estimateCharsPerPage,
  isPublicationFormat,
  fontPxFor,
  FONT_SCALE_ORDER,
  webPageGeometry,
} from "./geometry";

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

describe("031 출판 판형 — 프리셋 + 실측 분량 근사", () => {
  it("isPublicationFormat — 판형 4종만 true, ISO 는 false", () => {
    expect(isPublicationFormat("sinkukpan")).toBe(true);
    expect(isPublicationFormat("kukpan")).toBe(true);
    expect(isPublicationFormat("pan46")).toBe(true);
    expect(isPublicationFormat("mungopan")).toBe(true);
    expect(isPublicationFormat("A4")).toBe(false);
    expect(isPublicationFormat("A5")).toBe(false);
  });

  it("recommendedFontPx — 판형은 출판 표준(작은) 폰트, ISO 는 기존 18px", () => {
    expect(recommendedFontPx("A4")).toBe(18);
    expect(recommendedFontPx("sinkukpan")).toBeLessThan(recommendedFontPx("A4"));
    // 판형 4종은 공통 폰트(연구 D2 — 폰트·행간 공통)
    expect(recommendedFontPx("kukpan")).toBe(recommendedFontPx("sinkukpan"));
    expect(recommendedFontPx("mungopan")).toBe(recommendedFontPx("sinkukpan"));
  });

  it("SC-002 앵커 — 신국판 1면 추정 분량이 200자 원고지 3.3~3.7매(700~800자) 범위", () => {
    const geo = pageGeometry("sinkukpan", recommendedFontPx("sinkukpan"));
    const chars = estimateCharsPerPage(geo);
    expect(chars).toBeGreaterThanOrEqual(700);
    expect(chars).toBeLessThanOrEqual(800);
  });

  it("판형별 분량 단조성 — 신국판 > 국판 > 46판 > 문고판 (면적·여백 차이)", () => {
    const cap = (s: "sinkukpan" | "kukpan" | "pan46" | "mungopan") =>
      estimateCharsPerPage(pageGeometry(s, recommendedFontPx(s)));
    expect(cap("sinkukpan")).toBeGreaterThan(cap("kukpan"));
    expect(cap("kukpan")).toBeGreaterThan(cap("pan46"));
    expect(cap("pan46")).toBeGreaterThan(cap("mungopan"));
  });

  it("판형 추가가 ISO 기하를 바꾸지 않는다 (A4 회귀 무변)", () => {
    const a4 = pageGeometry("A4", 18);
    // 기존 25mm 여백·18px 폰트 유지
    expect(a4.pageWidthPx).toBeCloseTo(210 * (96 / 25.4), 5);
    expect(a4.fontSizePx).toBe(18);
    expect(a4.lineHeightPx).toBeCloseTo(18 * 1.8, 5);
  });
});

describe("031 US5 글자 크기 5단 — fontPxFor (판형 기본 + 덮어쓰기)", () => {
  it("'m'(보통)은 판형 기본 폰트 그대로 (덮어쓰기 안 함)", () => {
    expect(fontPxFor("sinkukpan", "m")).toBe(recommendedFontPx("sinkukpan"));
    expect(fontPxFor("A4", "m")).toBe(recommendedFontPx("A4"));
  });

  it("5단이 단조 증가 (xs < s < m < l < xl)", () => {
    const sizes = FONT_SCALE_ORDER.map((s) => fontPxFor("sinkukpan", s));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it("판형 기본 위에 배수 적용 — 신국판(15px) 기준값", () => {
    expect(fontPxFor("sinkukpan", "m")).toBe(15);
    expect(fontPxFor("sinkukpan", "xs")).toBe(12); // round(15×0.8)
    expect(fontPxFor("sinkukpan", "xl")).toBe(20); // round(15×1.3)=19.5→20
  });

  it("ISO 도 같은 5단이 자기 기본(18px) 위에 적용", () => {
    expect(fontPxFor("A4", "m")).toBe(18);
    expect(fontPxFor("A4", "xl")).toBeGreaterThan(18);
    expect(fontPxFor("A4", "xs")).toBeLessThan(18);
  });

  it("FONT_SCALE_ORDER 는 5단", () => {
    expect(FONT_SCALE_ORDER).toEqual(["xs", "s", "m", "l", "xl"]);
  });
});

describe("031 US3 webPageGeometry — 웹 연속(페이지 분할 없음)", () => {
  it("contentHeightPx 가 Infinity (layout 이 분할 안 함 → 단일 페이지)", () => {
    const geo = webPageGeometry(900, 18);
    expect(geo.contentHeightPx).toBe(Infinity);
    expect(geo.pageHeightPx).toBe(Infinity);
  });

  it("폭은 읽기 칼럼 최대(760)로 제한 — 넓은 화면도 과하게 안 넓어짐", () => {
    const wide = webPageGeometry(1400, 18);
    expect(wide.pageWidthPx).toBeLessThanOrEqual(760);
  });

  it("좁은 화면은 가용 폭에 맞춤(reflow)", () => {
    const narrow = webPageGeometry(360, 18);
    expect(narrow.pageWidthPx).toBe(360);
    expect(narrow.contentWidthPx).toBeLessThan(360);
  });

  it("fontSizePx 그대로, lineHeightPx = font × 1.8", () => {
    const geo = webPageGeometry(700, 16);
    expect(geo.fontSizePx).toBe(16);
    expect(geo.lineHeightPx).toBeCloseTo(16 * 1.8, 5);
  });
});

describe("mobilePageGeometry — 026 모바일 reflow", () => {
  it("pageWidthPx 가 가용 화면 폭과 같다 (fit-to-width 축소 없이 폭에 맞춤)", () => {
    const geo = mobilePageGeometry(360, 18);
    expect(geo.pageWidthPx).toBe(360);
  });

  it("pageHeightPx 는 A4 세로 비율(297/210)을 유지한다 (여전히 종이·페이지 분할)", () => {
    const geo = mobilePageGeometry(360, 18);
    expect(geo.pageHeightPx).toBeCloseTo(360 * (297 / 210), 5);
  });

  it("contentWidthPx = pageWidthPx − 2×margin (margin = 폭의 6%)", () => {
    const geo = mobilePageGeometry(360, 18);
    const margin = 360 * 0.06;
    expect(geo.contentWidthPx).toBeCloseTo(360 - 2 * margin, 5);
  });

  it("fontSizePx 는 인자 그대로, lineHeightPx = fontSizePx × 1.8 (글자 원본 크기)", () => {
    const geo = mobilePageGeometry(360, 18);
    expect(geo.fontSizePx).toBe(18);
    expect(geo.lineHeightPx).toBeCloseTo(18 * 1.8, 5);
  });

  it("좁은 화면일수록 contentWidthPx 가 좁아 줄당 글자수가 준다 (reflow)", () => {
    const narrow = mobilePageGeometry(320, 18);
    const wide = mobilePageGeometry(414, 18);
    expect(narrow.contentWidthPx).toBeLessThan(wide.contentWidthPx);
  });
});
