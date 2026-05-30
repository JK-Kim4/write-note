import { describe, expect, it } from "vitest";
import {
    countCharsForManuscript,
    calcManuscriptPages,
    getManuscriptDimensions,
} from "./manuscript";

/**
 * 원고지 매수 계산 단위 테스트 (006 T023).
 *
 * 매수 = ceil(공백제외_자수 / 칸수)
 * 칸수 = 200 | 400 | 1000
 * 크기 변환 = 같은 자수에 다른 칸수 적용 (본문 불변, 유실 0)
 */

describe("countCharsForManuscript", () => {
    it("ProseMirror JSON 본문에서 공백 제외 자수를 반환한다", () => {
        const body = JSON.stringify({
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "가나다라마" }] },
                { type: "paragraph", content: [{ type: "text", text: "바사아자" }] },
            ],
        });
        expect(countCharsForManuscript(body)).toBe(9);
    });

    it("공백(스페이스/탭/개행)을 매수 계산에서 제외한다", () => {
        const body = JSON.stringify({
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "안 녕 하 세 요" }] },
            ],
        });
        // "안녕하세요" = 5자, 공백 4개 제외
        expect(countCharsForManuscript(body)).toBe(5);
    });

    it("빈 문서는 0을 반환한다", () => {
        const body = JSON.stringify({ type: "doc", content: [] });
        expect(countCharsForManuscript(body)).toBe(0);
    });

    it("잘못된 JSON 이면 0을 반환한다", () => {
        expect(countCharsForManuscript("not-json")).toBe(0);
    });
});

describe("calcManuscriptPages", () => {
    it("200자 원고지: 자수÷200 올림으로 매수를 반환한다", () => {
        expect(calcManuscriptPages(200, 200)).toBe(1);
        expect(calcManuscriptPages(201, 200)).toBe(2);
        expect(calcManuscriptPages(0, 200)).toBe(0);
    });

    it("400자 원고지: 자수÷400 올림으로 매수를 반환한다", () => {
        expect(calcManuscriptPages(400, 400)).toBe(1);
        expect(calcManuscriptPages(1, 400)).toBe(1);
        expect(calcManuscriptPages(800, 400)).toBe(2);
    });

    it("1000자 원고지: 자수÷1000 올림으로 매수를 반환한다", () => {
        expect(calcManuscriptPages(1000, 1000)).toBe(1);
        expect(calcManuscriptPages(1001, 1000)).toBe(2);
        expect(calcManuscriptPages(0, 1000)).toBe(0);
    });

    it("크기 변환 — 같은 자수(600자)를 400→200으로 바꿔도 유실 없이 매수만 늘어난다", () => {
        const chars = 600;
        // 600자 / 400칸 = 1.5 → 2매
        expect(calcManuscriptPages(chars, 400)).toBe(2);
        // 600자 / 200칸 = 3 → 3매
        expect(calcManuscriptPages(chars, 200)).toBe(3);
        // 600자 / 1000칸 = 0.6 → 1매
        expect(calcManuscriptPages(chars, 1000)).toBe(1);
    });
});

describe("getManuscriptDimensions", () => {
    it("200자 원고지는 10열×20행을 반환한다", () => {
        expect(getManuscriptDimensions(200)).toEqual({ cols: 10, rows: 20 });
    });

    it("400자 원고지는 20열×20행을 반환한다", () => {
        expect(getManuscriptDimensions(400)).toEqual({ cols: 20, rows: 20 });
    });

    it("1000자 원고지는 25열×40행을 반환한다", () => {
        expect(getManuscriptDimensions(1000)).toEqual({ cols: 25, rows: 40 });
    });
});
