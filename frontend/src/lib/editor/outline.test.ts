import { describe, expect, it } from "vitest";
import { outlineFromDoc } from "./outline";

/**
 * 아웃라인 파생 순수함수 단위 테스트 (017 US1, TDD).
 *
 * outlineFromDoc: ProseMirror JSON 문자열 → level 1·2 heading 목차 항목.
 * 기존 countCharsForManuscript(manuscript.ts) 컨벤션(JSON 문자열 입력) 정합.
 */

const doc = (...content: unknown[]) => JSON.stringify({ type: "doc", content });
const heading = (level: number, text: string) => ({
    type: "heading",
    attrs: { level },
    content: text ? [{ type: "text", text }] : [],
});
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("outlineFromDoc", () => {
    it("빈 문자열은 빈 배열을 반환한다", () => {
        expect(outlineFromDoc("")).toEqual([]);
    });

    it("파싱 실패(잘못된 JSON)는 빈 배열을 반환한다", () => {
        expect(outlineFromDoc("{not json")).toEqual([]);
    });

    it("빈 문서는 빈 배열을 반환한다", () => {
        expect(outlineFromDoc(doc())).toEqual([]);
    });

    it("H1·H2 를 등장 순서대로 level·text·index 와 함께 추출한다", () => {
        const body = doc(heading(1, "1부"), para("본문"), heading(2, "1장"), heading(2, "2장"));
        expect(outlineFromDoc(body)).toEqual([
            { level: 1, text: "1부", index: 0 },
            { level: 2, text: "1장", index: 1 },
            { level: 2, text: "2장", index: 2 },
        ]);
    });

    it("H3 를 등장 순서대로 포함한다", () => {
        const body = doc(heading(1, "큰제목"), heading(3, "소제목"), heading(2, "중제목"));
        expect(outlineFromDoc(body)).toEqual([
            { level: 1, text: "큰제목", index: 0 },
            { level: 3, text: "소제목", index: 1 },
            { level: 2, text: "중제목", index: 2 },
        ]);
    });

    it("level 4 이상 heading 은 제외한다", () => {
        const body = doc(heading(1, "큰제목"), heading(4, "제외"), heading(3, "소제목"), heading(2, "중제목"));
        expect(outlineFromDoc(body)).toEqual([
            { level: 1, text: "큰제목", index: 0 },
            { level: 3, text: "소제목", index: 1 },
            { level: 2, text: "중제목", index: 2 },
        ]);
    });

    it("heading 이 아닌 노드(문단·인용·목록)는 무시한다", () => {
        const body = doc(para("그냥 문단"), { type: "blockquote", content: [para("인용")] }, heading(2, "제목"));
        expect(outlineFromDoc(body)).toEqual([{ level: 2, text: "제목", index: 0 }]);
    });

    it("빈/공백 텍스트 heading 도 항목으로 유지한다(텍스트는 그대로)", () => {
        const body = doc(heading(2, ""), heading(1, "  "));
        expect(outlineFromDoc(body)).toEqual([
            { level: 2, text: "", index: 0 },
            { level: 1, text: "  ", index: 1 },
        ]);
    });

    it("같은 텍스트가 중복돼도 각각 별개 항목으로 index 로 구분한다", () => {
        const body = doc(heading(2, "장면"), heading(2, "장면"));
        expect(outlineFromDoc(body)).toEqual([
            { level: 2, text: "장면", index: 0 },
            { level: 2, text: "장면", index: 1 },
        ]);
    });

    it("heading 안 여러 텍스트 노드는 이어붙인다", () => {
        const body = JSON.stringify({
            type: "doc",
            content: [
                {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [
                        { type: "text", text: "앞" },
                        { type: "text", text: "뒤" },
                    ],
                },
            ],
        });
        expect(outlineFromDoc(body)).toEqual([{ level: 2, text: "앞뒤", index: 0 }]);
    });
});
