import { describe, it, expect } from "vitest";
import type { DocModel, BlockAttr } from "./model";
import { outlineFromModel, headingBlockIndices } from "./outline";

// 모델 생성 헬퍼
function makeModel(buffer: string, attrs: BlockAttr[]): DocModel {
  const parts = buffer.split("\n");
  const markRuns = parts.map((seg) => (seg.length === 0 ? [] : [{ len: seg.length, mask: 0 }]));
  return { buffer, blockAttrs: attrs, markRuns };
}

describe("outlineFromModel — T018/T024", () => {
  it("heading 없으면 빈 배열", () => {
    const m = makeModel("본문\n두 번째", [{ type: "paragraph" }, { type: "paragraph" }]);
    expect(outlineFromModel(m)).toEqual([]);
  });

  it("heading 혼합 모델 — 등장 순서대로 OutlineItem[] 반환", () => {
    const m = makeModel("대제목\n본문\n중제목\n소제목", [
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
    ]);
    const outline = outlineFromModel(m);
    expect(outline).toHaveLength(3);
    expect(outline[0]).toEqual({ level: 1, text: "대제목", index: 0 });
    expect(outline[1]).toEqual({ level: 2, text: "중제목", index: 1 });
    expect(outline[2]).toEqual({ level: 3, text: "소제목", index: 2 });
  });

  it("heading 만 있는 경우", () => {
    const m = makeModel("H1\nH2", [
      { type: "heading", level: 1 },
      { type: "heading", level: 2 },
    ]);
    const outline = outlineFromModel(m);
    expect(outline).toHaveLength(2);
    expect(outline[0]).toEqual({ level: 1, text: "H1", index: 0 });
    expect(outline[1]).toEqual({ level: 2, text: "H2", index: 1 });
  });

  it("빈 텍스트 heading 도 포함 (text = '')", () => {
    const m = makeModel("\n본문", [{ type: "heading", level: 1 }, { type: "paragraph" }]);
    const outline = outlineFromModel(m);
    expect(outline).toHaveLength(1);
    expect(outline[0]).toEqual({ level: 1, text: "", index: 0 });
  });

  it("index 는 heading 등장 순번(0-base) — paragraph 사이 끼어도 연속 번호", () => {
    const m = makeModel("H1\n본문\nH2\n본문2\nH3", [
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "heading", level: 2 },
    ]);
    const outline = outlineFromModel(m);
    expect(outline.map((o) => o.index)).toEqual([0, 1, 2]);
  });
});

describe("headingBlockIndices — T018/T024", () => {
  it("heading 없으면 빈 배열", () => {
    const m = makeModel("본문", [{ type: "paragraph" }]);
    expect(headingBlockIndices(m)).toEqual([]);
  });

  it("heading 이 있는 블록 인덱스를 등장 순서대로 반환", () => {
    const m = makeModel("대제목\n본문\n중제목\n소제목", [
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
    ]);
    expect(headingBlockIndices(m)).toEqual([0, 2, 3]);
  });

  it("모든 블록이 heading 이면 전체 인덱스", () => {
    const m = makeModel("a\nb\nc", [
      { type: "heading", level: 1 },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
    ]);
    expect(headingBlockIndices(m)).toEqual([0, 1, 2]);
  });
});
