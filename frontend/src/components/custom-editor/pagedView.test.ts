import { describe, expect, it } from "vitest";
import { clampPage, nextPage, prevPage, pageToFollowCaret } from "./pagedView";

describe("clampPage", () => {
    it("[0, total-1] 로 가둔다", () => {
        expect(clampPage(3, 12)).toBe(3);
        expect(clampPage(-1, 12)).toBe(0);
        expect(clampPage(20, 12)).toBe(11);
    });
    it("total<=0 이면 0", () => {
        expect(clampPage(5, 0)).toBe(0);
        expect(clampPage(5, -2)).toBe(0);
    });
});

describe("nextPage / prevPage", () => {
    it("clamp 적용 ±1", () => {
        expect(nextPage(0, 3)).toBe(1);
        expect(nextPage(2, 3)).toBe(2); // 마지막에서 더 안 감
        expect(prevPage(2, 3)).toBe(1);
        expect(prevPage(0, 3)).toBe(0); // 처음에서 더 안 감
    });
});

describe("pageToFollowCaret", () => {
    it("캐럿 페이지가 현재와 다르면 그 인덱스, 같으면 null", () => {
        expect(pageToFollowCaret(2, 0)).toBe(2);
        expect(pageToFollowCaret(0, 0)).toBeNull();
    });
});
