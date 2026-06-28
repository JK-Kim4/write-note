import { describe, expect, it } from "vitest";
import { removedWorkIds } from "./publicWorkSelection";

describe("removedWorkIds", () => {
    it("현재 공개 작품 중 새 선택에서 빠진 작품을 반환한다(=공개 해제 대상)", () => {
        expect(removedWorkIds([1, 2, 3], new Set([2, 3]))).toEqual([1]);
    });

    it("여럿 해제 시 원래 순서를 보존해 모두 반환한다", () => {
        expect(removedWorkIds([1, 2, 3, 4], new Set([2]))).toEqual([1, 3, 4]);
    });

    it("현재 공개 작품이 모두 선택에 남으면 빈 배열", () => {
        expect(removedWorkIds([1, 2], new Set([1, 2, 3]))).toEqual([]);
    });

    it("현재 공개 작품이 없으면 빈 배열(신규 선택만)", () => {
        expect(removedWorkIds([], new Set([1, 2]))).toEqual([]);
    });
});
