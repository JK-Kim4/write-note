import { describe, expect, it } from "vitest";
import type { DocModel, MarkRun } from "./model";
import { MARK } from "./model";
import { pmJsonToModel, modelToPmJson } from "./pmConvert";

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

function makePmDoc(nodes: object[]): string {
  return JSON.stringify({ type: "doc", content: nodes });
}

function para(text: string) {
  return text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };
}

function heading(level: 1 | 2 | 3, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

// DocModel 생성 헬퍼 (markRuns 포함)
function makeModel(buffer: string, blockAttrs: DocModel["blockAttrs"], markRuns?: MarkRun[][]): DocModel {
  const parts = buffer.split("\n");
  const runs: MarkRun[][] =
    markRuns ??
    parts.map((seg) => (seg.length === 0 ? [] : [{ len: seg.length, mask: 0 }]));
  return { buffer, blockAttrs, markRuns: runs };
}

// ─── pmJsonToModel ───────────────────────────────────────────────────────────

describe("pmJsonToModel", () => {
  it("단일 문단 → paragraph 블록 1개", () => {
    const json = makePmDoc([para("안녕하세요")]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("안녕하세요");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  it("다문단 → 블록 여러개, buffer 는 개행 join", () => {
    const json = makePmDoc([para("첫째"), para("둘째"), para("셋째")]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("첫째\n둘째\n셋째");
    expect(m.blockAttrs).toEqual([
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
  });

  it("heading level 1 → {type:'heading', level:1} attr", () => {
    const json = makePmDoc([heading(1, "제목1")]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("제목1");
    expect(m.blockAttrs).toEqual([{ type: "heading", level: 1 }]);
  });

  it("heading level 2 → {type:'heading', level:2} attr", () => {
    const json = makePmDoc([heading(2, "제목2")]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs).toEqual([{ type: "heading", level: 2 }]);
  });

  it("heading level 3 → {type:'heading', level:3} attr", () => {
    const json = makePmDoc([heading(3, "제목3")]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs).toEqual([{ type: "heading", level: 3 }]);
  });

  it("paragraph·heading 혼합", () => {
    const json = makePmDoc([
      heading(1, "챕터1"),
      para("본문 A"),
      heading(2, "소제목"),
      para("본문 B"),
    ]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("챕터1\n본문 A\n소제목\n본문 B");
    expect(m.blockAttrs).toEqual([
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "heading", level: 2 },
      { type: "paragraph" },
    ]);
  });

  it("빈 paragraph → 빈 텍스트 블록", () => {
    const json = makePmDoc([para("앞"), { type: "paragraph" }, para("뒤")]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("앞\n\n뒤");
    expect(m.blockAttrs).toEqual([
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
  });

  it("빈 content([]) → 빈 모델 1블록", () => {
    const json = JSON.stringify({ type: "doc", content: [] });
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  it("content 필드 자체 없음 → 빈 모델 1블록", () => {
    const json = JSON.stringify({ type: "doc" });
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  it("잘못된 JSON → 빈 모델 1블록", () => {
    const m = pmJsonToModel("nonsense");
    expect(m.buffer).toBe("");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  it("빈 문자열 → 빈 모델 1블록", () => {
    const m = pmJsonToModel("");
    expect(m.buffer).toBe("");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  // ── 평탄화(lossy) ──

  it("bulletList → listItem 별 paragraph 블록으로 평탄화", () => {
    const json = makePmDoc([
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목A" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목B" }] }] },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    // 텍스트 보존, 구조 소실 (리스트 → 여러 paragraph)
    expect(m.buffer).toContain("항목A");
    expect(m.buffer).toContain("항목B");
    expect(m.blockAttrs.every((a) => a.type === "paragraph")).toBe(true);
  });

  it("blockquote → paragraph 블록으로 평탄화 (텍스트 보존)", () => {
    const json = makePmDoc([
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "인용문" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toContain("인용문");
    expect(m.blockAttrs.every((a) => a.type === "paragraph")).toBe(true);
  });

  it("marks(bold) 무시 — 텍스트는 보존, markRuns 에 반영", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "일반", marks: [] },
          { type: "text", text: "굵게", marks: [{ type: "bold" }] },
          { type: "text", text: "또일반" },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("일반굵게또일반");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
    // markRuns: "일반"(mask0,2) + "굵게"(bold,2) + "또일반"(mask0,3) 정규화
    expect(m.markRuns[0]).toEqual([
      { len: 2, mask: 0 },
      { len: 2, mask: MARK.bold },
      { len: 3, mask: 0 },
    ]);
  });

  it("U+FFFC(이미지 마커) 세그먼트 → 빈 paragraph", () => {
    const json = makePmDoc([
      para("앞"),
      { type: "image", attrs: { src: "img.png" } },
      para("뒤"),
    ]);
    const m = pmJsonToModel(json);
    // image 는 lossy — paragraph 로 평탄화
    expect(m.blockAttrs.every((a) => a.type === "paragraph")).toBe(true);
  });
});

// ─── modelToPmJson ───────────────────────────────────────────────────────────

describe("modelToPmJson", () => {
  it("단일 paragraph → PM paragraph 노드", () => {
    const m = makeModel("안녕", [{ type: "paragraph" }]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("paragraph");
    expect(doc.content[0].content[0].text).toBe("안녕");
  });

  it("빈 paragraph → content 생략(빈 paragraph 노드)", () => {
    const m = makeModel("", [{ type: "paragraph" }]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("paragraph");
    expect(doc.content[0].content).toBeUndefined();
  });

  it("heading level 1·2·3 → PM heading 노드 attrs.level", () => {
    const m = makeModel("제목1\n제목2\n제목3", [
      { type: "heading", level: 1 },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
    ]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(doc.content[1]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(doc.content[2]).toMatchObject({ type: "heading", attrs: { level: 3 } });
  });

  it("다문단 → PM content 배열 순서 보존", () => {
    const m = makeModel("가\n나\n다", [
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].content[0].text).toBe("가");
    expect(doc.content[2].content[0].text).toBe("다");
  });

  it("U+FFFC 세그먼트 → 빈 paragraph (content 생략)", () => {
    const m = makeModel("￼", [{ type: "paragraph" }]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0].type).toBe("paragraph");
    // U+FFFC 는 빈 paragraph 로 — content 없어야 함
    expect(doc.content[0].content).toBeUndefined();
  });
});

// ─── 왕복 무손실 (핵심) ───────────────────────────────────────────────────────

describe("왕복 무손실 (pmJsonToModel ∘ modelToPmJson)", () => {
  function roundTrip(m: DocModel): DocModel {
    return pmJsonToModel(modelToPmJson(m));
  }

  it("단일 paragraph 왕복", () => {
    const m = makeModel("안녕하세요", [{ type: "paragraph" }]);
    expect(roundTrip(m)).toEqual(m);
  });

  it("다문단 왕복", () => {
    const m = makeModel("첫째\n둘째\n셋째", [
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
    expect(roundTrip(m)).toEqual(m);
  });

  it("heading 1·2·3 혼합 왕복", () => {
    const m = makeModel("챕터\n소제목\n소소제목\n본문", [
      { type: "heading", level: 1 },
      { type: "heading", level: 2 },
      { type: "heading", level: 3 },
      { type: "paragraph" },
    ]);
    expect(roundTrip(m)).toEqual(m);
  });

  it("빈 블록 포함 왕복", () => {
    const m = makeModel("앞\n\n뒤", [
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
    expect(roundTrip(m)).toEqual(m);
  });

  it("heading 과 빈 paragraph 혼합 왕복", () => {
    const m = makeModel("제목\n\n내용", [
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
    expect(roundTrip(m)).toEqual(m);
  });

  it("단일 빈 모델 왕복 (INV-3)", () => {
    const m = makeModel("", [{ type: "paragraph" }]);
    expect(roundTrip(m)).toEqual(m);
  });
});

describe("정규화 고정점 — 유실 회귀 가드(BCustomChapterEditor serverBody 정규화)", () => {
    // modelToPmJson(pmJsonToModel(x)) 를 normalize 라 할 때, 두 번 적용해도 같아야(fixed point)
    // serverBody 를 normalize 해 baseline 으로 쓰면 로드 직후 body===baseline 이 되어 거짓 dirty 가 없다.
    const inputs = [
        JSON.stringify({ type: "doc", content: [] }),
        JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }] }),
        JSON.stringify({ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "장" }] }] }),
    ];
    const normalize = (x: string) => modelToPmJson(pmJsonToModel(x));
    for (const input of inputs) {
        it(`normalize 는 고정점이다: ${input.slice(0, 40)}`, () => {
            const once = normalize(input);
            const twice = normalize(once);
            expect(twice).toBe(once); // 두 번째 적용은 불변 → 로드 시 body===정규화 serverBody
        });
    }
});

// ─── T015: 마크 왕복 무손실 ────────────────────────────────────────────────

describe("T015: pmConvert 마크 왕복", () => {
  it("bold 마크 왕복 무손실", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "일반" },
          { type: "text", text: "굵게", marks: [{ type: "bold" }] },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.markRuns[0]).toEqual([
      { len: 2, mask: 0 },
      { len: 2, mask: MARK.bold },
    ]);
    // 역변환
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });

  it("italic 마크 왕복 무손실", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "기울임", marks: [{ type: "italic" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.markRuns[0]).toEqual([{ len: 3, mask: MARK.italic }]);
    expect(pmJsonToModel(modelToPmJson(m))).toEqual(m);
  });

  it("underline 마크 왕복 무손실", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "밑줄", marks: [{ type: "underline" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.markRuns[0]).toEqual([{ len: 2, mask: MARK.underline }]);
    expect(pmJsonToModel(modelToPmJson(m))).toEqual(m);
  });

  it("strike 마크 왕복 무손실", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "취소", marks: [{ type: "strike" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.markRuns[0]).toEqual([{ len: 2, mask: MARK.strike }]);
    expect(pmJsonToModel(modelToPmJson(m))).toEqual(m);
  });

  it("bold + italic 복합 마크 왕복 무손실", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "복합",
            marks: [{ type: "bold" }, { type: "italic" }],
          },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.markRuns[0]).toEqual([{ len: 2, mask: MARK.bold | MARK.italic }]);
    expect(pmJsonToModel(modelToPmJson(m))).toEqual(m);
  });

  it("인접 동일 마스크 병합 — 정규화", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "A", marks: [{ type: "bold" }] },
          { type: "text", text: "B", marks: [{ type: "bold" }] },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    // 인접 bold → 병합
    expect(m.markRuns[0]).toEqual([{ len: 2, mask: MARK.bold }]);
  });

  it("idempotence: 2회 왕복 동일", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hi" },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
        ],
      },
    ]);
    const m1 = pmJsonToModel(json);
    const m2 = pmJsonToModel(modelToPmJson(m1));
    const m3 = pmJsonToModel(modelToPmJson(m2));
    expect(m3).toEqual(m2);
  });

  it("미지원 마크(link 등) 평탄화 — 비트마스크에 없음", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "링크", marks: [{ type: "link", attrs: { href: "http://x" } }] },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    // 미지원 마크 → mask 0
    expect(m.markRuns[0]).toEqual([{ len: 2, mask: 0 }]);
  });

  it("마크 없는 모델 → 1라운드 출력과 바이트 동일 (하위호환, 거짓 dirty 차단)", () => {
    // 마크 없는 모델 (maskRuns 전부 mask 0)
    const m = makeModel("안녕\n세계", [{ type: "paragraph" }, { type: "paragraph" }]);
    const output = modelToPmJson(m);
    // 1라운드 기대 출력: 단순 text node (marks 없음)
    const doc = JSON.parse(output);
    // paragraph 노드의 text node 에 marks 필드 없어야 함
    for (const block of doc.content) {
      if (block.content) {
        for (const node of block.content) {
          expect(node.marks).toBeUndefined();
        }
      }
    }
  });
});
