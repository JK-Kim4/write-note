import { describe, it, expect } from "vitest";
import { docModelToExportBlocks, buildExportDoc } from "./exportDoc";
import type { DocModel } from "@/components/custom-editor/model";
import { MARK } from "@/components/custom-editor/model";
import type { CollectedChapter } from "./collectChapters";

describe("docModelToExportBlocks", () => {
  it("heading·paragraph·마크를 ExportBlock 으로 변환한다", () => {
    const model: DocModel = {
      buffer: "제목\n굵은글",
      blockAttrs: [{ type: "heading", level: 1 }, { type: "paragraph" }],
      markRuns: [[{ len: 2, mask: 0 }], [{ len: 3, mask: MARK.bold }]],
    };
    const blocks = docModelToExportBlocks(model);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1, text: "제목" });
    expect(blocks[1]).toMatchObject({ type: "paragraph", text: "굵은글" });
    expect(blocks[1].marks).toEqual([{ start: 0, end: 3, bold: true }]);
  });

  it("U+2028 소프트 줄바꿈을 \\n 으로 정규화한다", () => {
    const model: DocModel = { buffer: "가 나", blockAttrs: [{ type: "paragraph" }], markRuns: [[{ len: 3, mask: 0 }]] };
    expect(docModelToExportBlocks(model)[0].text).toBe("가\n나");
  });
});

describe("buildExportDoc", () => {
  it("paperSize·joinMode·챕터 제목을 담는다", () => {
    const pm = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] });
    const chapters: CollectedChapter[] = [{ id: 1, title: "1장", bodyJson: pm }];
    const doc = buildExportDoc(chapters, "A4", "page-title");
    expect(doc.paperSize).toBe("A4");
    expect(doc.joinMode).toBe("page-title");
    expect(doc.chapters[0].title).toBe("1장");
    expect(doc.chapters[0].blocks[0]).toMatchObject({ type: "paragraph", text: "본문" });
  });
});
