import { describe, expect, it } from "vitest";
import { formatRelativeTime, selectDashboard, startOfWeekMonday } from "./dashboardView";
import type { ProjectCard } from "@/lib/types/domain";

function card(over: Partial<ProjectCard> & { id: number; docUpdatedAt: string }): ProjectCard {
    return {
        id: over.id,
        title: `작품 ${over.id}`,
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        archivedAt: null,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        lastSentenceSource: "",
        wordCount: 0,
        totalDurationMs: 0,
        ...over,
    };
}

describe("selectDashboard", () => {
    it("빈 배열이면 resume null + others 빈 배열", () => {
        expect(selectDashboard([])).toEqual({ resume: null, others: [] });
    });

    it("1편이면 그 작품이 resume, others 는 빈 배열", () => {
        const only = card({ id: 1, docUpdatedAt: "2026-06-10T00:00:00Z" });
        expect(selectDashboard([only])).toEqual({ resume: only, others: [] });
    });

    it("문서 저장 시각 내림차순 — 최신이 resume, 나머지는 내림차순 others", () => {
        const old = card({ id: 1, docUpdatedAt: "2026-06-01T00:00:00Z" });
        const newest = card({ id: 2, docUpdatedAt: "2026-06-10T02:00:00Z" });
        const mid = card({ id: 3, docUpdatedAt: "2026-06-05T00:00:00Z" });

        const { resume, others } = selectDashboard([old, newest, mid]);

        expect(resume?.id).toBe(2);
        expect(others.map((c) => c.id)).toEqual([3, 1]);
    });

    it("저장 시각 동률이면 id 내림차순(결정적 — 새로고침 간 일관)", () => {
        const a = card({ id: 1, docUpdatedAt: "2026-06-10T00:00:00Z" });
        const b = card({ id: 2, docUpdatedAt: "2026-06-10T00:00:00Z" });

        const { resume, others } = selectDashboard([a, b]);

        expect(resume?.id).toBe(2);
        expect(others.map((c) => c.id)).toEqual([1]);
    });

    it("입력 배열을 변형하지 않는다", () => {
        const input = [card({ id: 1, docUpdatedAt: "2026-06-01T00:00:00Z" }), card({ id: 2, docUpdatedAt: "2026-06-10T00:00:00Z" })];
        selectDashboard(input);
        expect(input.map((c) => c.id)).toEqual([1, 2]);
    });
});

describe("formatRelativeTime", () => {
    const now = new Date("2026-06-10T12:00:00Z");

    it("1분 미만은 '방금'", () => {
        expect(formatRelativeTime("2026-06-10T11:59:30Z", now)).toBe("방금");
    });

    it("1시간 미만은 'N분 전'", () => {
        expect(formatRelativeTime("2026-06-10T11:55:00Z", now)).toBe("5분 전");
    });

    it("24시간 미만은 'N시간 전'", () => {
        expect(formatRelativeTime("2026-06-10T10:00:00Z", now)).toBe("2시간 전");
    });

    it("그 외는 'N일 전'", () => {
        expect(formatRelativeTime("2026-06-07T12:00:00Z", now)).toBe("3일 전");
    });
});

describe("startOfWeekMonday", () => {
    it("수요일이면 이번 주 월요일 00:00(로컬)을 돌려준다", () => {
        const wed = new Date(2026, 5, 10, 15, 30, 0); // 2026-06-10 수요일(로컬)
        expect(startOfWeekMonday(wed)).toEqual(new Date(2026, 5, 8, 0, 0, 0, 0));
    });

    it("월요일 당일이면 그날 00:00 — 주 시작 직후 진입도 같은 주", () => {
        const mon = new Date(2026, 5, 8, 0, 30, 0);
        expect(startOfWeekMonday(mon)).toEqual(new Date(2026, 5, 8, 0, 0, 0, 0));
    });

    it("일요일이면 6일 전 월요일 — 일요일은 주의 마지막 날", () => {
        const sun = new Date(2026, 5, 14, 23, 59, 59);
        expect(startOfWeekMonday(sun)).toEqual(new Date(2026, 5, 8, 0, 0, 0, 0));
    });
});
