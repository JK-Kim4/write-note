import { describe, expect, it } from "vitest";
import { formatStopwatch } from "./formatStopwatch";

describe("formatStopwatch", () => {
    it("0 이면 00:00:00", () => {
        expect(formatStopwatch(0)).toBe("00:00:00");
    });
    it("분·초를 0패딩한다", () => {
        expect(formatStopwatch(12 * 60_000 + 47_000)).toBe("00:12:47");
    });
    it("시간 단위를 넘긴다", () => {
        expect(formatStopwatch(3 * 3_600_000 + 5 * 60_000 + 9_000)).toBe("03:05:09");
    });
    it("음수는 00:00:00 으로 가드", () => {
        expect(formatStopwatch(-500)).toBe("00:00:00");
    });
});
