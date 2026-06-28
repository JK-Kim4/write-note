import { describe, expect, it } from "vitest";
import { deriveAnchor, quoteForAnchor } from "./anchorFromSelection";

describe("deriveAnchor", () => {
    const lengths = [10, 5, 20]; // 3개 블록 텍스트 길이

    it("단일 블록 정방향 선택을 앵커로 변환한다", () => {
        expect(deriveAnchor(lengths, { startBlock: 0, startOffset: 2, endBlock: 0, endOffset: 7 })).toEqual({
            blockIndex: 0,
            start: 2,
            length: 5,
        });
    });

    it("역방향 선택을 정규화해 같은 앵커를 만든다", () => {
        expect(deriveAnchor(lengths, { startBlock: 0, startOffset: 7, endBlock: 0, endOffset: 2 })).toEqual({
            blockIndex: 0,
            start: 2,
            length: 5,
        });
    });

    it("여러 블록에 걸친 선택은 null(Phase 1 단일 블록만)", () => {
        expect(deriveAnchor(lengths, { startBlock: 0, startOffset: 3, endBlock: 1, endOffset: 2 })).toBeNull();
    });

    it("빈(collapsed) 선택은 null", () => {
        expect(deriveAnchor(lengths, { startBlock: 1, startOffset: 3, endBlock: 1, endOffset: 3 })).toBeNull();
    });

    it("블록 인덱스가 범위를 벗어나면 null", () => {
        expect(deriveAnchor(lengths, { startBlock: 5, startOffset: 0, endBlock: 5, endOffset: 2 })).toBeNull();
        expect(deriveAnchor(lengths, { startBlock: -1, startOffset: 0, endBlock: -1, endOffset: 2 })).toBeNull();
    });

    it("끝 오프셋이 블록 길이를 넘으면 길이 내로 clamp 한다", () => {
        expect(deriveAnchor(lengths, { startBlock: 1, startOffset: 1, endBlock: 1, endOffset: 99 })).toEqual({
            blockIndex: 1,
            start: 1,
            length: 4, // len 5 로 clamp → 5-1
        });
    });

    it("길이 0 블록(빈 문단) 선택은 null", () => {
        expect(deriveAnchor([0, 3], { startBlock: 0, startOffset: 0, endBlock: 0, endOffset: 1 })).toBeNull();
    });
});

describe("quoteForAnchor", () => {
    it("앵커 구간의 본문을 잘라낸다", () => {
        expect(quoteForAnchor("작가의 한 문장입니다", 4, 4)).toBe("한 문장");
    });

    it("음수·과대 길이는 안전하게 처리한다", () => {
        expect(quoteForAnchor("abc", -1, 2)).toBe("ab");
        expect(quoteForAnchor("abc", 1, 99)).toBe("bc");
    });
});
