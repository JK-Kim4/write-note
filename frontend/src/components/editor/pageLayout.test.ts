/**
 * pageLayout.ts 단위 테스트 — Phase 2: PaperGeometry 파라미터화.
 *
 * RED → GREEN: paperGeometry 파라미터화 전에 이 테스트가 먼저 실패함을 확인.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
    LINE_PX,
    PAPER_PRESETS,
    paperGeometry,
    pageCount,
    globalLineAt,
    pageNumberTopsPx,
    type PaperGeometry,
} from "./pageLayout";

const LINE = LINE_PX; // 34.56

describe("PAPER_PRESETS", () => {
    it("A4 프리셋 값이 올바르다", () => {
        expect(PAPER_PRESETS.A4).toEqual({ widthMm: 210, heightMm: 297, bodyLines: 26 });
    });

    it("B4(JIS) 프리셋 값이 올바르다", () => {
        expect(PAPER_PRESETS.B4).toEqual({ widthMm: 257, heightMm: 364, bodyLines: 32 });
    });

    it("A3 프리셋 값이 올바르다", () => {
        expect(PAPER_PRESETS.A3).toEqual({ widthMm: 297, heightMm: 420, bodyLines: 37 });
    });

    it("A2 프리셋 값이 올바르다", () => {
        expect(PAPER_PRESETS.A2).toEqual({ widthMm: 420, heightMm: 594, bodyLines: 52 });
    });
});

describe("paperGeometry — A4 회귀 가드 (현 상수와 완전 일치)", () => {
    let g: PaperGeometry;
    beforeAll(() => {
        g = paperGeometry("A4");
    });

    it("bodyLines = 26", () => expect(g.bodyLines).toBe(26));
    it("sheetLines = 28 (bodyLines + 2)", () => expect(g.sheetLines).toBe(28));
    it("strideLines = 30 (bodyLines + 4)", () => expect(g.strideLines).toBe(30));
    it("pageHpx = 26 * LINE_PX (현 A4 본문 높이)", () => expect(g.pageHpx).toBeCloseTo(26 * LINE, 8));
    it("sheetHpx = 28 * LINE_PX (현 SHEET_H_PX 와 동일)", () => expect(g.sheetHpx).toBeCloseTo(28 * LINE, 8));
    it("stridePx = 30 * LINE_PX (현 PAGE_STRIDE_PX 와 동일)", () => expect(g.stridePx).toBeCloseTo(30 * LINE, 8));
    it("colWidthMm = 160 (210 - 50)", () => expect(g.colWidthMm).toBe(160));
    it("maxWidthMm = 210", () => expect(g.maxWidthMm).toBe(210));
});

describe("paperGeometry — 4종 파생값", () => {
    it("B4: bodyLines 32, sheetLines 34, strideLines 36", () => {
        const g = paperGeometry("B4");
        expect(g.bodyLines).toBe(32);
        expect(g.sheetLines).toBe(34);
        expect(g.strideLines).toBe(36);
        expect(g.pageHpx).toBeCloseTo(32 * LINE, 8);
        expect(g.sheetHpx).toBeCloseTo(34 * LINE, 8);
        expect(g.stridePx).toBeCloseTo(36 * LINE, 8);
        expect(g.colWidthMm).toBe(207); // 257 - 50
        expect(g.maxWidthMm).toBe(257);
    });

    it("A3: bodyLines 37, sheetLines 39, strideLines 41", () => {
        const g = paperGeometry("A3");
        expect(g.bodyLines).toBe(37);
        expect(g.sheetLines).toBe(39);
        expect(g.strideLines).toBe(41);
        expect(g.colWidthMm).toBe(247); // 297 - 50
        expect(g.maxWidthMm).toBe(297);
    });

    it("A2: bodyLines 52, sheetLines 54, strideLines 56", () => {
        const g = paperGeometry("A2");
        expect(g.bodyLines).toBe(52);
        expect(g.sheetLines).toBe(54);
        expect(g.strideLines).toBe(56);
        expect(g.colWidthMm).toBe(370); // 420 - 50
        expect(g.maxWidthMm).toBe(420);
    });
});

describe("pageCount — geometry 주입 시그니처", () => {
    const a4 = paperGeometry("A4");

    it("A4 geometry 로 1장 — 기존 동작 보존", () => {
        // flowHeight < stride → 1장
        expect(pageCount(100, 1, a4.stridePx)).toBe(1);
    });

    it("A4 geometry 로 정확히 1 stride = 1장 (마지막 장이 꽉 참 = 알고리즘 상 1장)", () => {
        const stride = a4.stridePx * 1; // zoom 1
        // floor(stride/stride - 0.001) = floor(0.999) = 0 → 0+1=1
        expect(pageCount(stride, 1, a4.stridePx)).toBe(1);
    });

    it("A4 geometry 로 stride*1.1 = 2장", () => {
        const flow = a4.stridePx * 1.1;
        expect(pageCount(flow, 1, a4.stridePx)).toBe(2);
    });

    it("zoom 적용 — 2배 줌 시 stride 도 2배", () => {
        // flowHeight = stride * zoom * 2.1 → 3장 (floor(2.1-0.001)=2 → 2+1=3)
        const flow = a4.stridePx * 2 * 2.1;
        expect(pageCount(flow, 2, a4.stridePx)).toBe(3);
    });

    it("B4 geometry 로 2장", () => {
        const b4 = paperGeometry("B4");
        const flow = b4.stridePx * 1.5;
        expect(pageCount(flow, 1, b4.stridePx)).toBe(2);
    });
});

describe("globalLineAt — geometry 주입 시그니처", () => {
    const a4 = paperGeometry("A4");

    it("0 이하는 0 — 기존 동작 보존", () => {
        expect(globalLineAt(0, a4.bodyLines, a4.strideLines)).toBe(0);
        expect(globalLineAt(-1, a4.bodyLines, a4.strideLines)).toBe(0);
    });

    it("첫 장 첫 줄 — 기존 동작 보존", () => {
        expect(globalLineAt(0.5, a4.bodyLines, a4.strideLines)).toBe(0);
    });

    it("첫 장 마지막 줄(25번째)", () => {
        // 25번째 줄 중간(25.5). bodyLines=26 → max row = 25
        expect(globalLineAt(25.5, a4.bodyLines, a4.strideLines)).toBe(25);
    });

    it("간격 구간(줄 26~29)은 이전 장 마지막 줄로 스냅", () => {
        // stride=30, bodyLines=26 → 26줄은 간격 구간 → 첫 장 25행 스냅
        expect(globalLineAt(27, a4.bodyLines, a4.strideLines)).toBe(25);
    });

    it("두 번째 장 두 번째 줄(stride=30 → page 1, within 1 → row 1)", () => {
        // linesFromTop=31: page=floor(31/30)=1, within=1, row=min(25,1)=1 → 1*26+1=27
        expect(globalLineAt(31, a4.bodyLines, a4.strideLines)).toBe(27);
    });

    it("두 번째 장 첫 줄(linesFromTop=30, within=0 → row 0)", () => {
        // linesFromTop=30: page=floor(30/30)=1, within=0, row=0 → 1*26+0=26
        expect(globalLineAt(30, a4.bodyLines, a4.strideLines)).toBe(26);
    });
});

describe("pageNumberTopsPx — geometry 주입 시그니처", () => {
    const a4 = paperGeometry("A4");

    it("1장: A4 기준 top = SHEET_H_PX - 0.5*LINE — 기존 동작 보존", () => {
        const tops = pageNumberTopsPx(1, a4.stridePx, a4.sheetHpx);
        expect(tops).toHaveLength(1);
        expect(tops[0]).toBeCloseTo(a4.sheetHpx - LINE * 0.5, 8);
    });

    it("2장: 두 번째 top = stride + sheetHpx - 0.5*LINE", () => {
        const tops = pageNumberTopsPx(2, a4.stridePx, a4.sheetHpx);
        expect(tops).toHaveLength(2);
        expect(tops[1]).toBeCloseTo(a4.stridePx + a4.sheetHpx - LINE * 0.5, 8);
    });

    it("B4 geometry 로 2장 top 계산", () => {
        const b4 = paperGeometry("B4");
        const tops = pageNumberTopsPx(2, b4.stridePx, b4.sheetHpx);
        expect(tops[0]).toBeCloseTo(b4.sheetHpx - LINE * 0.5, 8);
        expect(tops[1]).toBeCloseTo(b4.stridePx + b4.sheetHpx - LINE * 0.5, 8);
    });
});
