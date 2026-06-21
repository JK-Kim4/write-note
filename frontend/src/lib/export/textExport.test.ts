import { describe, it, expect } from "vitest";
import { buildPlainText, buildExportJson } from "./textExport";
import type { CollectedChapter } from "./collectChapters";

/** PM JSON 문자열 헬퍼 — 단락 1개 문서. */
const doc = (text: string): string =>
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

const chapters: CollectedChapter[] = [
    { id: 1, title: "1장", bodyJson: doc("가나다") },
    { id: 2, title: "2장", bodyJson: doc("라마바") },
];

describe("buildPlainText — 평문 합본(031)", () => {
    it("body-only — 제목 없이 본문만 이어붙임", () => {
        const out = buildPlainText(chapters, "body-only");
        expect(out).toContain("가나다");
        expect(out).toContain("라마바");
        expect(out).not.toContain("1장");
    });

    it("inline-title — 제목 + 본문", () => {
        const out = buildPlainText(chapters, "inline-title");
        expect(out).toContain("1장");
        expect(out).toContain("가나다");
        expect(out.indexOf("1장")).toBeLessThan(out.indexOf("가나다"));
    });

    it("제목 없는 챕터는 (제목 없음) 으로 표기(body-only 제외)", () => {
        const out = buildPlainText([{ id: 3, title: "  ", bodyJson: doc("내용") }], "inline-title");
        expect(out).toContain("(제목 없음)");
    });
});

describe("buildExportJson — 구조화 JSON 합본(031)", () => {
    it("chapters 배열에 title·text·body(파싱된 PM) 포함", () => {
        const parsed = JSON.parse(buildExportJson(chapters));
        expect(parsed.chapters).toHaveLength(2);
        expect(parsed.chapters[0].title).toBe("1장");
        expect(parsed.chapters[0].text).toContain("가나다");
        expect(parsed.chapters[0].body.type).toBe("doc");
    });

    it("깨진 bodyJson 은 body=null 로 안전 처리(throw 없음)", () => {
        const parsed = JSON.parse(buildExportJson([{ id: 9, title: "x", bodyJson: "not json" }]));
        expect(parsed.chapters[0].body).toBeNull();
    });
});
