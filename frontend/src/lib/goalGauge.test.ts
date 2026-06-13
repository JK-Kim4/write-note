import { describe, expect, it } from "vitest";
import { goalProgress } from "./goalGauge";

describe("goalProgress", () => {
    it("targetLength가 null이면 null(게이지 미표시)", () => {
        expect(goalProgress(1000, null)).toBeNull();
    });
    it("달성률(0~1)과 퍼센트를 반환한다", () => {
        expect(goalProgress(25000, 50000)).toEqual({ ratio: 0.5, percent: 50 });
    });
    it("100%를 초과해도 ratio는 1로 클램프한다", () => {
        expect(goalProgress(60000, 50000)).toEqual({ ratio: 1, percent: 120 });
    });
});
