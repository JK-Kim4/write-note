import { beforeEach, describe, expect, it } from "vitest";
import { getLastViewedBoard, rememberLastViewedBoard } from "./lastViewedBoard";

/**
 * 043 집필 참조 — 작품별 "마지막 본 보드" localStorage 기억(순수 헬퍼).
 * SettingsService.ALLOWED 가 값 화이트리스트라 임의 boardId 서버 키 불가 → localStorage(비파괴).
 */
describe("lastViewedBoard", () => {
    beforeEach(() => localStorage.clear());

    it("기억한 적 없으면 null", () => {
        expect(getLastViewedBoard(7)).toBeNull();
    });

    it("작품별로 마지막 본 보드를 기억하고 되읽는다", () => {
        rememberLastViewedBoard(7, 100);
        rememberLastViewedBoard(8, 200);
        expect(getLastViewedBoard(7)).toBe(100);
        expect(getLastViewedBoard(8)).toBe(200);
    });

    it("같은 작품을 다시 기억하면 덮어쓴다", () => {
        rememberLastViewedBoard(7, 100);
        rememberLastViewedBoard(7, 101);
        expect(getLastViewedBoard(7)).toBe(101);
    });

    it("손상된 저장값이면 null(throw 안 함)", () => {
        localStorage.setItem("writenote.board.lastViewed.v1", "{not json");
        expect(getLastViewedBoard(7)).toBeNull();
    });
});
