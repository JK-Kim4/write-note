import { describe, expect, it } from "vitest";
import { extractPlainText, calcProgress } from "./wordCountUtils";

/**
 * 자수 계산 / 진행률 단위 테스트 (006 T009).
 *
 * 자수 = ProseMirror JSON 문자열에서 text node 내용을 이어붙인 길이.
 * 진행률 = wordCount / targetLength (0..1 clamped).
 */

const makeDoc = (texts: string[]) =>
    JSON.stringify({
        type: "doc",
        content: texts.map((t) => ({
            type: "paragraph",
            content: t ? [{ type: "text", text: t }] : undefined,
        })),
    });

describe("extractPlainText", () => {
    it("단락의 text node 내용을 이어붙인다", () => {
        const body = makeDoc(["안녕하세요", "반갑습니다"]);
        expect(extractPlainText(body)).toBe("안녕하세요반갑습니다");
    });

    it("빈 단락은 빈 문자열로 처리한다", () => {
        const body = makeDoc([""]);
        expect(extractPlainText(body)).toBe("");
    });

    it("잘못된 JSON 이면 빈 문자열을 반환한다", () => {
        expect(extractPlainText("not-json")).toBe("");
    });

    it("type 이 doc 이 아니면 빈 문자열을 반환한다", () => {
        expect(extractPlainText(JSON.stringify({ type: "paragraph", content: [] }))).toBe("");
    });
});

describe("calcProgress", () => {
    it("wordCount / targetLength 를 0..1 로 반환한다", () => {
        expect(calcProgress(500, 1000)).toBeCloseTo(0.5);
    });

    it("wordCount 가 targetLength 를 넘으면 1 로 clamp 한다", () => {
        expect(calcProgress(1500, 1000)).toBe(1);
    });

    it("targetLength 가 0 이하이면 0 을 반환한다", () => {
        expect(calcProgress(100, 0)).toBe(0);
    });

    it("wordCount 가 0 이면 0 을 반환한다", () => {
        expect(calcProgress(0, 1000)).toBe(0);
    });
});
