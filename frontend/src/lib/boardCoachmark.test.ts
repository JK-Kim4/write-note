import { beforeEach, describe, expect, it } from "vitest";
import { hasSeenLinkHint, markLinkHintSeen } from "./boardCoachmark";

/**
 * 045 보드 "끌어서 잇기" 첫-진입 코치마크 — 본 적 있는지 localStorage 기억(순수, 전역 1회성).
 * SettingsService.ALLOWED 가 값 화이트리스트라 서버 키 불가 → localStorage(FE only, 043 lastViewedBoard 선례).
 */
const KEY = "writenote.board.coachmark.v1";

describe("boardCoachmark", () => {
    beforeEach(() => localStorage.clear());

    it("본 적 없으면 false", () => {
        expect(hasSeenLinkHint()).toBe(false);
    });

    it("markLinkHintSeen 후 true", () => {
        markLinkHintSeen();
        expect(hasSeenLinkHint()).toBe(true);
    });

    it("여러 번 호출해도 안전(멱등)", () => {
        markLinkHintSeen();
        markLinkHintSeen();
        expect(hasSeenLinkHint()).toBe(true);
    });

    it("손상된 저장값이면 false(throw 안 함)", () => {
        localStorage.setItem(KEY, "{not json");
        expect(hasSeenLinkHint()).toBe(false);
    });

    it("linkHint 키가 없는 객체면 false", () => {
        localStorage.setItem(KEY, JSON.stringify({ other: 1 }));
        expect(hasSeenLinkHint()).toBe(false);
    });

    it("기존 다른 키를 보존하며 병합한다(향후 확장 대비)", () => {
        localStorage.setItem(KEY, JSON.stringify({ other: 1 }));
        markLinkHintSeen();
        const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
        expect(stored.other).toBe(1);
        expect(stored.linkHint).toBe(true);
    });
});
