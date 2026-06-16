import { describe, it, expect } from "vitest";
import { mergeChaptersForPrint } from "./mergeChapters";
import type { CollectedChapter } from "./collectChapters";

const pm = (t: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
const chapters: CollectedChapter[] = [
  { id: 1, title: "1장", bodyJson: pm("가나다") },
  { id: 2, title: "2장", bodyJson: pm("라마바") },
];

describe("mergeChaptersForPrint", () => {
  it("page-title: 챕터 수만큼 DocModel, 각 첫 블록이 제목 heading", () => {
    const models = mergeChaptersForPrint(chapters, "page-title");
    expect(models).toHaveLength(2);
    expect(models[0].blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    expect(models[0].buffer.split("\n")[0]).toBe("1장");
    expect(models[1].buffer.split("\n")[0]).toBe("2장");
  });

  it("body-only: 단일 DocModel, 제목 블록 없음, 본문만 연결", () => {
    const models = mergeChaptersForPrint(chapters, "body-only");
    expect(models).toHaveLength(1);
    expect(models[0].buffer).toBe("가나다\n라마바");
    expect(models[0].blockAttrs.every((a) => a.type !== "heading")).toBe(true);
  });

  it("inline-title: 단일 DocModel, 챕터 제목이 heading 으로 사이에 삽입", () => {
    const models = mergeChaptersForPrint(chapters, "inline-title");
    expect(models).toHaveLength(1);
    const segs = models[0].buffer.split("\n");
    expect(segs[0]).toBe("1장");
    expect(models[0].blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    expect(segs).toContain("2장");
  });
});
