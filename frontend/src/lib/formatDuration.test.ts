import { describe, expect, it } from "vitest";
import { formatDurationKo } from "./formatDuration";

describe("formatDurationKo", () => {
    it("0ms → '0분'", () => {
        expect(formatDurationKo(0)).toBe("0분");
    });

    it("40_000ms (40초) → '1분 미만'", () => {
        expect(formatDurationKo(40_000)).toBe("1분 미만");
    });

    it("5 * 60_000ms (5분) → '5분'", () => {
        expect(formatDurationKo(5 * 60_000)).toBe("5분");
    });

    it("3_600_000ms (1시간) → '1시간'", () => {
        expect(formatDurationKo(3_600_000)).toBe("1시간");
    });

    it("(1시간 5분)ms → '1시간 5분'", () => {
        expect(formatDurationKo((1 * 3600 + 5 * 60) * 1000)).toBe("1시간 5분");
    });
});
