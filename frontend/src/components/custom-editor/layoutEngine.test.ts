import { describe, it, expect } from "vitest";
import { layout, type MeasuredBlock } from "./layoutEngine";

/** 높이 h 인 줄 n 개짜리 문단. */
const para = (id: string, n: number, h = 20): MeasuredBlock => ({
    kind: "paragraph",
    id,
    lines: Array.from({ length: n }, (_, i) => ({ height: h, start: i, end: i + 1 })),
});
const img = (id: string, height: number): MeasuredBlock => ({ kind: "image", id, height });

// contentHeight 100 + 줄높이 20 = 페이지당 5줄.
const CH = 100;

describe("layout — 페이지네이션 엔진", () => {
    it("한 페이지에 들어가는 문단은 한 페이지 한 조각", () => {
        const pages = layout([para("p", 4)], CH);
        expect(pages).toHaveLength(1);
        expect(pages[0].fragments).toEqual([
            { kind: "paragraph", blockId: "p", startLine: 0, endLine: 3, offsetY: 0, height: 80 },
        ]);
    });

    it("문단이 페이지를 넘으면 줄 경계에서 다음 페이지로 이어진다(통째 점프 없음)", () => {
        const pages = layout([para("p", 7)], CH); // 5줄 + 2줄
        expect(pages).toHaveLength(2);
        expect(pages[0].fragments).toEqual([
            { kind: "paragraph", blockId: "p", startLine: 0, endLine: 4, offsetY: 0, height: 100 },
        ]);
        expect(pages[1].fragments).toEqual([
            { kind: "paragraph", blockId: "p", startLine: 5, endLine: 6, offsetY: 0, height: 40 },
        ]);
    });

    it("이미지가 남은 공간에 안 들어가면 통째로 다음 페이지로 밀리고 빈 공간이 남는다", () => {
        const pages = layout([para("p", 3), img("im", 50)], CH); // 문단 60 사용, 남은 40 < 이미지 50
        expect(pages).toHaveLength(2);
        expect(pages[0].usedHeight).toBe(60); // 빈 공간(40) 남김
        expect(pages[0].fragments.map((f) => f.kind)).toEqual(["paragraph"]);
        expect(pages[1].fragments).toEqual([{ kind: "image", blockId: "im", offsetY: 0, height: 50 }]);
    });

    it("이미지가 남은 공간에 들어가면 같은 페이지에 놓인다", () => {
        const pages = layout([para("p", 2), img("im", 50)], CH); // 문단 40 + 이미지 50 = 90 ≤ 100
        expect(pages).toHaveLength(1);
        expect(pages[0].fragments).toEqual([
            { kind: "paragraph", blockId: "p", startLine: 0, endLine: 1, offsetY: 0, height: 40 },
            { kind: "image", blockId: "im", offsetY: 40, height: 50 },
        ]);
    });

    it("페이지 높이를 바꾸면 분할이 재계산된다(규격/폰트 변경 리플로우)", () => {
        const blocks = [para("p", 3), img("im", 50)];
        expect(layout(blocks, 100)).toHaveLength(2); // 좁은 페이지: 이미지 밀림
        expect(layout(blocks, 200)).toHaveLength(1); // 넓은 페이지: 한 장에
    });

    it("여러 블록이 문서 순서대로 연속 배치된다", () => {
        const pages = layout([para("a", 2), para("b", 2)], CH); // 40 + 40 = 80, 한 페이지
        expect(pages).toHaveLength(1);
        expect(pages[0].fragments).toEqual([
            { kind: "paragraph", blockId: "a", startLine: 0, endLine: 1, offsetY: 0, height: 40 },
            { kind: "paragraph", blockId: "b", startLine: 0, endLine: 1, offsetY: 40, height: 40 },
        ]);
    });

    it("빈 문서는 빈 페이지 하나", () => {
        const pages = layout([], CH);
        expect(pages).toHaveLength(1);
        expect(pages[0].fragments).toEqual([]);
    });

    // ─────────────────────────────────────────
    // T017: 가변 줄높이 — heading 블록과 본문 블록 혼합 시 실제 height 누적 기준 분할
    // FR-008 보호: layout 은 줄별 height 를 그대로 누적해야 함
    // ─────────────────────────────────────────
    it("T017-1: heading 줄(50px) + 본문 줄(32.4px) 혼합 — 실제 height 누적 기준 페이지 경계 분할", () => {
        // contentHeight = 100px
        // heading 블록: 줄 1개 × 50px
        // 본문 블록: 줄 4개 × 32.4px = 129.6px → 페이지 경계에서 분할 필요
        const headingBlock: MeasuredBlock = {
            kind: "paragraph",
            id: "h",
            lines: [{ height: 50, start: 0, end: 10 }],
        };
        const bodyBlock: MeasuredBlock = {
            kind: "paragraph",
            id: "b",
            lines: Array.from({ length: 4 }, (_, i) => ({ height: 32.4, start: i, end: i + 1 })),
        };
        const pages = layout([headingBlock, bodyBlock], CH);
        // 첫 페이지: heading(50) + body 1줄(32.4) = 82.4 (다음 줄 더하면 50+64.8=114.8 > 100 → 분할)
        // 즉, 첫 페이지 = heading(50) + body 1줄(32.4) = 82.4px
        expect(pages).toHaveLength(2);
        expect(pages[0].usedHeight).toBeCloseTo(82.4, 5);
        // 두 번째 페이지: body 3줄 × 32.4 = 97.2px
        expect(pages[1].usedHeight).toBeCloseTo(97.2, 5);
    });

    it("T017-2: heading 줄(50px) 이 페이지 끝에 위치해도 정확히 경계에 들어가는 경우", () => {
        // contentHeight = 100px
        // 본문 5줄 × 20px = 100px (딱 맞게 채움)
        // heading 줄 50px → 다음 페이지로 넘어가야 함
        const bodyBlock: MeasuredBlock = {
            kind: "paragraph",
            id: "p",
            lines: Array.from({ length: 5 }, (_, i) => ({ height: 20, start: i, end: i + 1 })),
        };
        const headingBlock: MeasuredBlock = {
            kind: "paragraph",
            id: "h",
            lines: [{ height: 50, start: 0, end: 10 }],
        };
        const pages = layout([bodyBlock, headingBlock], CH);
        // bodyBlock이 정확히 100px이면 heading은 다음 페이지
        expect(pages).toHaveLength(2);
        expect(pages[0].usedHeight).toBe(100);
        expect(pages[1].fragments[0]).toMatchObject({ kind: "paragraph", blockId: "h" });
        expect(pages[1].usedHeight).toBe(50);
    });
});
