import { describe, expect, it } from "vitest";
import { gaugeFill, formatDurationMinutes, formatTodayDuration, todayMinutes, isGoalReached } from "./todayGauge";

const MIN = 60_000;

describe("gaugeFill", () => {
    it("오늘/목표 비율을 0~1 로 반환한다", () => {
        expect(gaugeFill(30 * MIN, 60)).toBeCloseTo(0.5);
        expect(gaugeFill(60 * MIN, 60)).toBeCloseTo(1);
    });

    it("0분이면 0, NaN/음수면 0 (NaN 가드)", () => {
        expect(gaugeFill(0, 60)).toBe(0);
        expect(gaugeFill(Number.NaN, 60)).toBe(0);
        expect(gaugeFill(-100, 60)).toBe(0);
    });

    it("목표 초과면 1 로 clamp", () => {
        expect(gaugeFill(180 * MIN, 60)).toBe(1);
    });

    it("목표가 0 이하라도 0 division 없이 0 반환", () => {
        expect(gaugeFill(60 * MIN, 0)).toBe(0);
    });
});

describe("todayMinutes", () => {
    it("ms 를 분(내림)으로", () => {
        expect(todayMinutes(90_000)).toBe(1);
        expect(todayMinutes(0)).toBe(0);
        expect(todayMinutes(Number.NaN)).toBe(0);
    });
});

describe("formatDurationMinutes", () => {
    it("분을 한국어 시간 표기로", () => {
        expect(formatDurationMinutes(30)).toBe("30분");
        expect(formatDurationMinutes(60)).toBe("1시간");
        expect(formatDurationMinutes(90)).toBe("1시간 30분");
        expect(formatDurationMinutes(0)).toBe("0분");
    });
});

describe("formatTodayDuration (분·초 표기)", () => {
    it("ms 를 시간·분·초로, 0 단위는 생략하되 0이면 0초", () => {
        expect(formatTodayDuration(0)).toBe("0초");
        expect(formatTodayDuration(30_000)).toBe("30초");
        expect(formatTodayDuration(90_000)).toBe("1분 30초");
        expect(formatTodayDuration(120_000)).toBe("2분");
        expect(formatTodayDuration(3_661_000)).toBe("1시간 1분 1초");
    });

    it("NaN/음수는 0초", () => {
        expect(formatTodayDuration(Number.NaN)).toBe("0초");
        expect(formatTodayDuration(-5)).toBe("0초");
    });
});

describe("isGoalReached", () => {
    it("오늘이 목표 이상이면 true", () => {
        expect(isGoalReached(60 * MIN, 60)).toBe(true);
        expect(isGoalReached(30 * MIN, 60)).toBe(false);
    });
});
