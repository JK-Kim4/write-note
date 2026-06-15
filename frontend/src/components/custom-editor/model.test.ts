import { describe, it, expect } from "vitest";
import type { DocModel, BlockAttr } from "./model";
import {
  blockIndexAt,
  insertText,
  deleteRange,
  splitBlock,
  mergeWithPrev,
  mergeWithNext,
  reconcileAttrs,
} from "./model";

// INV-1 보조: blockAttrs.length === buffer.split('\n').length
function assertINV1(model: DocModel, label: string) {
  const blocks = model.buffer.split("\n");
  expect(model.blockAttrs.length, `INV-1 위반 [${label}]`).toBe(blocks.length);
}

// 초기 모델 생성 헬퍼
function makeModel(buffer: string, attrs?: BlockAttr[]): DocModel {
  const blocks = buffer.split("\n");
  const blockAttrs: BlockAttr[] = attrs ?? blocks.map(() => ({ type: "paragraph" as const }));
  return { buffer, blockAttrs };
}

// ─────────────────────────────────────────
// INV-3: 빈 모델 형태
// ─────────────────────────────────────────
describe("INV-3: 빈 모델", () => {
  it("빈 버퍼는 블록 1개 paragraph 를 가진다", () => {
    const model = makeModel("");
    assertINV1(model, "빈 모델");
    expect(model.blockAttrs).toHaveLength(1);
    expect(model.blockAttrs[0]).toEqual({ type: "paragraph" });
  });
});

// ─────────────────────────────────────────
// blockIndexAt
// ─────────────────────────────────────────
describe("blockIndexAt — 오프셋→블록 인덱스", () => {
  // 버퍼: "ab\ncd\nef" (길이 8, 개행 2개 → 3블록)
  //  블록0: "ab"  오프셋 0-1
  //  '\n'         오프셋 2  → 블록0의 끝(경계: 이전 블록)
  //  블록1: "cd"  오프셋 3-4
  //  '\n'         오프셋 5  → 블록1의 끝
  //  블록2: "ef"  오프셋 6-7
  const model = makeModel("ab\ncd\nef");

  it("블록0 내부 오프셋은 0을 반환", () => {
    expect(blockIndexAt(model, 0)).toBe(0);
    expect(blockIndexAt(model, 1)).toBe(0);
  });

  it("개행 위치(오프셋 2)는 이전 블록(0)을 반환 — 경계 규약: 개행은 이전 블록 끝", () => {
    expect(blockIndexAt(model, 2)).toBe(0);
  });

  it("블록1 내부는 1을 반환", () => {
    expect(blockIndexAt(model, 3)).toBe(1);
    expect(blockIndexAt(model, 4)).toBe(1);
  });

  it("블록2 내부는 2를 반환", () => {
    expect(blockIndexAt(model, 6)).toBe(2);
    expect(blockIndexAt(model, 7)).toBe(2);
  });
});

// ─────────────────────────────────────────
// insertText
// ─────────────────────────────────────────
describe("insertText", () => {
  it("단순 텍스트 삽입 — INV-1 유지", () => {
    const m = makeModel("hello");
    const result = insertText(m, 5, 5, " world");
    expect(result.buffer).toBe("hello world");
    expect(result.blockAttrs).toHaveLength(1);
    assertINV1(result, "단순 삽입");
  });

  it("선택 범위 치환 — INV-1 유지", () => {
    const m = makeModel("hello world");
    const result = insertText(m, 6, 11, "there");
    expect(result.buffer).toBe("hello there");
    assertINV1(result, "선택 치환");
  });

  it("개행 포함 삽입 시 블록 증가 — 새 블록은 paragraph", () => {
    const m = makeModel("hello", [{ type: "heading", level: 1 }]);
    const result = insertText(m, 5, 5, "\nworld");
    // 버퍼: "hello\nworld" → 2블록
    expect(result.buffer).toBe("hello\nworld");
    expect(result.blockAttrs).toHaveLength(2);
    // 첫 블록: heading 유지
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    // 새 블록: paragraph
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    assertINV1(result, "개행 삽입");
  });

  it("두 개의 개행 삽입 시 블록 3개 — INV-1", () => {
    const m = makeModel("a");
    const result = insertText(m, 1, 1, "\nb\nc");
    expect(result.buffer).toBe("a\nb\nc");
    expect(result.blockAttrs).toHaveLength(3);
    assertINV1(result, "두 개행 삽입");
  });

  it("선택 치환 중 개행 포함 — 블록 증감 후 INV-1", () => {
    // "aaa\nbbb" → [0,3] 을 "X\nY" 로 치환 → "X\nY\nbbb"
    const m = makeModel("aaa\nbbb");
    const result = insertText(m, 0, 3, "X\nY");
    expect(result.buffer).toBe("X\nY\nbbb");
    expect(result.blockAttrs).toHaveLength(3);
    assertINV1(result, "치환+개행");
  });
});

// ─────────────────────────────────────────
// splitBlock
// ─────────────────────────────────────────
describe("splitBlock", () => {
  it("본문 중간 분할 → 두 블록, 앞 attr 유지, 새 블록 paragraph", () => {
    const m = makeModel("hello world", [{ type: "paragraph" }]);
    const result = splitBlock(m, 5);
    expect(result.buffer).toBe("hello\n world");
    expect(result.blockAttrs).toHaveLength(2);
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    assertINV1(result, "단락 중간 분할");
  });

  it("heading 블록 분할 → 앞은 heading 유지, 뒤는 paragraph", () => {
    const m = makeModel("# 제목입니다", [{ type: "heading", level: 1 }]);
    const result = splitBlock(m, 5);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    assertINV1(result, "heading 분할");
  });

  it("블록 끝에서 분할 → 뒤 블록은 빈 paragraph", () => {
    const m = makeModel("hi");
    const result = splitBlock(m, 2);
    expect(result.buffer).toBe("hi\n");
    expect(result.blockAttrs).toHaveLength(2);
    assertINV1(result, "끝 분할");
  });

  it("블록 시작에서 분할 → 앞 블록 빈 paragraph", () => {
    const m = makeModel("hi");
    const result = splitBlock(m, 0);
    expect(result.buffer).toBe("\nhi");
    expect(result.blockAttrs).toHaveLength(2);
    assertINV1(result, "시작 분할");
  });
});

// ─────────────────────────────────────────
// mergeWithPrev
// ─────────────────────────────────────────
describe("mergeWithPrev", () => {
  it("블록1을 블록0과 병합 → 이전 attr(paragraph) 유지, 현재 attr 제거, INV-1", () => {
    const m = makeModel("hello\nworld");
    const result = mergeWithPrev(m, 1);
    expect(result.buffer).toBe("helloworld");
    expect(result.blockAttrs).toHaveLength(1);
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    assertINV1(result, "mergeWithPrev 기본");
  });

  it("이전이 heading이면 병합 후 heading attr 유지", () => {
    const m = makeModel("제목\n본문", [
      { type: "heading", level: 2 },
      { type: "paragraph" },
    ]);
    const result = mergeWithPrev(m, 1);
    expect(result.buffer).toBe("제목본문");
    expect(result.blockAttrs).toHaveLength(1);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 2 });
    assertINV1(result, "mergeWithPrev heading");
  });

  it("blockIdx === 0 이면 무변경", () => {
    const m = makeModel("hello\nworld");
    const result = mergeWithPrev(m, 0);
    expect(result.buffer).toBe("hello\nworld");
    expect(result.blockAttrs).toHaveLength(2);
    assertINV1(result, "mergeWithPrev idx=0 무변경");
  });

  it("3블록 중 블록2 병합 → 블록1 attr 유지", () => {
    const m = makeModel("a\nb\nc", [
      { type: "heading", level: 1 },
      { type: "heading", level: 2 },
      { type: "paragraph" },
    ]);
    const result = mergeWithPrev(m, 2);
    expect(result.buffer).toBe("a\nbc");
    expect(result.blockAttrs).toHaveLength(2);
    expect(result.blockAttrs[1]).toEqual({ type: "heading", level: 2 });
    assertINV1(result, "mergeWithPrev 3블록");
  });
});

// ─────────────────────────────────────────
// mergeWithNext
// ─────────────────────────────────────────
describe("mergeWithNext", () => {
  it("블록0 과 블록1 병합 → 블록0 attr 유지, 블록1 attr 제거", () => {
    const m = makeModel("hello\nworld", [
      { type: "heading", level: 3 },
      { type: "paragraph" },
    ]);
    const result = mergeWithNext(m, 0);
    expect(result.buffer).toBe("helloworld");
    expect(result.blockAttrs).toHaveLength(1);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 3 });
    assertINV1(result, "mergeWithNext 기본");
  });

  it("마지막 블록이면 무변경", () => {
    const m = makeModel("hello\nworld");
    const result = mergeWithNext(m, 1);
    expect(result.buffer).toBe("hello\nworld");
    expect(result.blockAttrs).toHaveLength(2);
    assertINV1(result, "mergeWithNext 마지막 블록 무변경");
  });
});

// ─────────────────────────────────────────
// deleteRange
// ─────────────────────────────────────────
describe("deleteRange", () => {
  it("단일 블록 내 범위 삭제 — INV-1", () => {
    const m = makeModel("hello world");
    const result = deleteRange(m, 5, 11);
    expect(result.buffer).toBe("hello");
    expect(result.blockAttrs).toHaveLength(1);
    assertINV1(result, "단일 블록 삭제");
  });

  it("다블록 걸친 선택 삭제 → 블록 병합, 시작 attr 유지", () => {
    const m = makeModel("aaa\nbbb\nccc", [
      { type: "heading", level: 1 },
      { type: "paragraph" },
      { type: "paragraph" },
    ]);
    // "aaa\nbbb\nccc" 에서 오프셋 [2,8) 삭제
    // slice(0,2)="aa", slice(8)="ccc" → "aaccc"
    const result = deleteRange(m, 2, 8);
    expect(result.buffer).toBe("aaccc");
    // 시작 attr(heading 1) 유지
    expect(result.blockAttrs).toHaveLength(1);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    assertINV1(result, "다블록 삭제");
  });

  it("개행을 포함한 삭제로 두 블록 병합 시 첫 블록 attr 유지 — INV-1", () => {
    const m = makeModel("hello\nworld", [
      { type: "heading", level: 2 },
      { type: "paragraph" },
    ]);
    // 개행(오프셋 5) 삭제 → 병합
    const result = deleteRange(m, 5, 6);
    expect(result.buffer).toBe("helloworld");
    expect(result.blockAttrs).toHaveLength(1);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 2 });
    assertINV1(result, "개행 삭제 병합");
  });

  it("lo === hi 이면 무변경", () => {
    const m = makeModel("hello");
    const result = deleteRange(m, 2, 2);
    expect(result.buffer).toBe("hello");
    assertINV1(result, "빈 범위 삭제");
  });
});

// ─────────────────────────────────────────
// reconcileAttrs
// ─────────────────────────────────────────
describe("reconcileAttrs", () => {
  it("blockAttrs 부족 시 paragraph 추가 → INV-1", () => {
    // 인위적으로 불일치 모델 생성 (makeModel 우회)
    const m: DocModel = {
      buffer: "a\nb\nc",
      blockAttrs: [{ type: "paragraph" }], // 1개만 (3개 필요)
    };
    const result = reconcileAttrs(m);
    expect(result.blockAttrs).toHaveLength(3);
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    expect(result.blockAttrs[2]).toEqual({ type: "paragraph" });
    assertINV1(result, "부족 보정");
  });

  it("blockAttrs 초과 시 절단 → INV-1", () => {
    const m: DocModel = {
      buffer: "a\nb",
      blockAttrs: [
        { type: "heading", level: 1 },
        { type: "paragraph" },
        { type: "paragraph" }, // 초과
        { type: "paragraph" }, // 초과
      ],
    };
    const result = reconcileAttrs(m);
    expect(result.blockAttrs).toHaveLength(2);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    assertINV1(result, "초과 절단");
  });

  it("이미 정합이면 변경 없음", () => {
    const m = makeModel("hello\nworld");
    const result = reconcileAttrs(m);
    expect(result.blockAttrs).toHaveLength(2);
    assertINV1(result, "정합 무변경");
  });
});

// ─────────────────────────────────────────
// INV-2: heading level 범위
// ─────────────────────────────────────────
describe("INV-2: heading level", () => {
  it("splitBlock 결과 heading attr 의 level 은 1|2|3 이어야 함", () => {
    const m = makeModel("제목", [{ type: "heading", level: 2 }]);
    const result = splitBlock(m, 1);
    const headingAttr = result.blockAttrs[0];
    expect(headingAttr.type).toBe("heading");
    if (headingAttr.type === "heading") {
      expect([1, 2, 3]).toContain(headingAttr.level);
    }
  });

  it("mergeWithPrev 후 heading level 유지", () => {
    const m = makeModel("a\nb", [{ type: "heading", level: 3 }, { type: "paragraph" }]);
    const result = mergeWithPrev(m, 1);
    const attr = result.blockAttrs[0];
    expect(attr.type).toBe("heading");
    if (attr.type === "heading") {
      expect([1, 2, 3]).toContain(attr.level);
      expect(attr.level).toBe(3);
    }
  });
});
