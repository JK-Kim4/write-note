import { describe, expect, it } from "vitest";
import type { DocModel, MarkRun } from "./model";
import { MARK, SOFT_BREAK } from "./model";
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

  it("bulletList → listItem{bullet,depth:0} 블록들로 변환 (R3: 구조 보존)", () => {
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
    // R3: 텍스트 보존 + listItem attr 보존
    expect(m.buffer).toContain("항목A");
    expect(m.buffer).toContain("항목B");
    expect(m.blockAttrs.every((a) => a.type === "listItem")).toBe(true);
  });

  it("blockquote → blockquote 블록으로 변환 (R3: 구조 보존, 텍스트 보존)", () => {
    const json = makePmDoc([
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "인용문" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toContain("인용문");
    expect(m.blockAttrs).toEqual([{ type: "blockquote" }]);
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

// ─── T023: 신규 노드 왕복 의미보존 ────────────────────────────────────────────

describe("T023: 신규 노드 왕복 의미보존", () => {
  // ── blockquote ──

  it("blockquote PM→모델: blockquote 블록 attr + 텍스트 보존", () => {
    const json = makePmDoc([
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "인용문" }] }],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs).toEqual([{ type: "blockquote" }]);
    expect(m.buffer).toBe("인용문");
  });

  it("blockquote 모델→PM: blockquote 블록 → PM blockquote 노드", () => {
    const m = makeModel("인용문", [{ type: "blockquote" }]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0].type).toBe("blockquote");
    expect(doc.content[0].content[0].type).toBe("paragraph");
    expect(doc.content[0].content[0].content[0].text).toBe("인용문");
  });

  it("blockquote 왕복 무손실", () => {
    const m = makeModel("인용문", [{ type: "blockquote" }]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });

  it("빈 blockquote 왕복", () => {
    const m = makeModel("", [{ type: "blockquote" }]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped.blockAttrs).toEqual([{ type: "blockquote" }]);
    expect(roundTripped.buffer).toBe("");
  });

  // ── bulletList / listItem ──

  it("bulletList PM→모델: listItem{bullet,depth:0} 블록들로 변환", () => {
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
    expect(m.blockAttrs).toEqual([
      { type: "listItem", listKind: "bullet", depth: 0 },
      { type: "listItem", listKind: "bullet", depth: 0 },
    ]);
    expect(m.buffer).toBe("항목A\n항목B");
  });

  it("orderedList PM→모델: listItem{ordered,depth:0} 블록들로 변환", () => {
    const json = makePmDoc([
      {
        type: "orderedList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "일" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "이" }] }] },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs).toEqual([
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    expect(m.buffer).toBe("일\n이");
  });

  it("중첩 bulletList PM→모델: depth:1 로 변환", () => {
    const json = makePmDoc([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "상위" }] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "하위" }] }] },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs[0]).toEqual({ type: "listItem", listKind: "bullet", depth: 0 });
    expect(m.blockAttrs[1]).toEqual({ type: "listItem", listKind: "bullet", depth: 1 });
    expect(m.buffer).toBe("상위\n하위");
  });

  it("bulletList 모델→PM: 연속 동일 listKind·depth → bulletList 노드로 재그룹", () => {
    const m = makeModel("가\n나", [
      { type: "listItem", listKind: "bullet", depth: 0 },
      { type: "listItem", listKind: "bullet", depth: 0 },
    ]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[0].content).toHaveLength(2);
    expect(doc.content[0].content[0].type).toBe("listItem");
    expect(doc.content[0].content[0].content[0].content[0].text).toBe("가");
  });

  it("orderedList 모델→PM: 연속 ordered → orderedList 노드", () => {
    const m = makeModel("일\n이", [
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0].type).toBe("orderedList");
  });

  it("bulletList 왕복 무손실", () => {
    const m = makeModel("가\n나\n다", [
      { type: "listItem", listKind: "bullet", depth: 0 },
      { type: "listItem", listKind: "bullet", depth: 0 },
      { type: "listItem", listKind: "bullet", depth: 0 },
    ]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });

  it("orderedList 왕복 무손실", () => {
    const m = makeModel("일\n이\n삼", [
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });

  it("다른 listKind 가 섞이면 별개 목록으로 분리", () => {
    const m = makeModel("가\n나", [
      { type: "listItem", listKind: "bullet", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    const doc = JSON.parse(modelToPmJson(m));
    // bullet과 ordered는 별개 노드
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].type).toBe("bulletList");
    expect(doc.content[1].type).toBe("orderedList");
  });

  // ── horizontalRule ──

  it("horizontalRule PM→모델: hr 블록 attr", () => {
    const json = makePmDoc([{ type: "horizontalRule" }]);
    const m = pmJsonToModel(json);
    expect(m.blockAttrs).toEqual([{ type: "hr" }]);
    expect(m.buffer).toBe("");
  });

  it("hr 모델→PM: hr 블록 → horizontalRule 노드", () => {
    const m: DocModel = {
      buffer: "",
      blockAttrs: [{ type: "hr" }],
      markRuns: [[]],
    };
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0].type).toBe("horizontalRule");
    expect(doc.content[0].content).toBeUndefined();
  });

  it("hr 왕복 무손실", () => {
    const m: DocModel = {
      buffer: "",
      blockAttrs: [{ type: "hr" }],
      markRuns: [[]],
    };
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped.blockAttrs).toEqual([{ type: "hr" }]);
    expect(roundTripped.buffer).toBe("");
  });

  // ── hardBreak / SOFT_BREAK ──

  it("hardBreak PM→모델: U+2028(SOFT_BREAK) 삽입", () => {
    const json = makePmDoc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "앞" },
          { type: "hardBreak" },
          { type: "text", text: "뒤" },
        ],
      },
    ]);
    const m = pmJsonToModel(json);
    expect(m.buffer).toBe("앞 뒤");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }]);
  });

  it("SOFT_BREAK 모델→PM: U+2028 → hardBreak 노드로 복원", () => {
    const m = makeModel("앞 뒤", [{ type: "paragraph" }]);
    const doc = JSON.parse(modelToPmJson(m));
    const content = doc.content[0].content;
    // 텍스트 "앞", hardBreak, 텍스트 "뒤" 순
    expect(content[0]).toMatchObject({ type: "text", text: "앞" });
    expect(content[1]).toMatchObject({ type: "hardBreak" });
    expect(content[2]).toMatchObject({ type: "text", text: "뒤" });
  });

  it("SOFT_BREAK 왕복 무손실", () => {
    const m = makeModel("앞 뒤", [{ type: "paragraph" }]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });

  it("연속 SOFT_BREAK 왕복", () => {
    const m = makeModel("a b c", [{ type: "paragraph" }]);
    const roundTripped = pmJsonToModel(modelToPmJson(m));
    expect(roundTripped).toEqual(m);
  });
});

// ─── T026: 결정론 idempotence (SC-002) ──────────────────────────────────────

describe("T026: idempotence 결정론 — 대표 문서 집합", () => {
  const normalize = (x: string) => modelToPmJson(pmJsonToModel(x));

  const representativeDocs = [
    // 빈 문서
    JSON.stringify({ type: "doc", content: [] }),
    // 단일 문단
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }] }),
    // 제목
    JSON.stringify({ type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "제목" }] }] }),
    // 마크(bold)
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "일반" }, { type: "text", text: "굵게", marks: [{ type: "bold" }] }] }] }),
    // blockquote
    JSON.stringify({ type: "doc", content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] }] }),
    // bulletList
    JSON.stringify({ type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목" }] }] }] }] }),
    // orderedList
    JSON.stringify({ type: "doc", content: [{ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "일" }] }] }] }] }),
    // horizontalRule
    JSON.stringify({ type: "doc", content: [{ type: "horizontalRule" }] }),
    // hardBreak
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "앞" }, { type: "hardBreak" }, { type: "text", text: "뒤" }] }] }),
    // 혼합(문단+제목+인용+목록+hr)
    JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "장" }] },
        { type: "paragraph", content: [{ type: "text", text: "본문" }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "인용" }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목" }] }] }] },
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "끝" }] },
      ],
    }),
  ];

  for (const input of representativeDocs) {
    it(`고정점(idempotent): ${input.slice(0, 60)}`, () => {
      const once = normalize(input);
      const twice = normalize(once);
      expect(twice).toBe(once);
    });
  }
});

// ─── T027: 무회귀 (SC-004) — 마크/신규블록 없는 입력은 R1/R2 출력과 바이트 동일 ──

describe("T027: 무회귀 — paragraph/heading/마크는 기존 출력과 바이트 동일", () => {
  it("단일 paragraph 무회귀", () => {
    const m = makeModel("안녕", [{ type: "paragraph" }]);
    const expected = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "안녕" }] }],
    });
    expect(modelToPmJson(m)).toBe(expected);
  });

  it("빈 paragraph 무회귀", () => {
    const m = makeModel("", [{ type: "paragraph" }]);
    const expected = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    expect(modelToPmJson(m)).toBe(expected);
  });

  it("heading 무회귀", () => {
    const m = makeModel("제목", [{ type: "heading", level: 1 }]);
    const expected = JSON.stringify({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "제목" }] }],
    });
    expect(modelToPmJson(m)).toBe(expected);
  });

  it("마크(bold) paragraph 무회귀", () => {
    const m: DocModel = {
      buffer: "일반굵게",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: 0 }, { len: 2, mask: MARK.bold }]],
    };
    const doc = JSON.parse(modelToPmJson(m));
    expect(doc.content[0].content[0].text).toBe("일반");
    expect(doc.content[0].content[0].marks).toBeUndefined();
    expect(doc.content[0].content[1].text).toBe("굵게");
    expect(doc.content[0].content[1].marks).toEqual([{ type: "bold" }]);
  });
});
