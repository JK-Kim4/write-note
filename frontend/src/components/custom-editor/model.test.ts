import { describe, it, expect } from "vitest";
import type { DocModel, BlockAttr, MarkRun, Mask } from "./model";
import {
  MARK,
  SOFT_BREAK,
  blockIndexAt,
  blockRuns,
  insertText,
  deleteRange,
  splitBlock,
  mergeWithPrev,
  mergeWithNext,
  reconcileAttrs,
  toggleHeading,
  toggleMark,
  marksAt,
  lineIndexFor,
  isAtomic,
  listNumberAt,
  toggleBlockType,
  insertHr,
  deleteAtomicAt,
  nextCaretSkippingAtomic,
  insertSoftBreak,
} from "./model";

// INV-1 보조: blockAttrs.length === buffer.split('\n').length
function assertINV1(model: DocModel, label: string) {
  const blocks = model.buffer.split("\n");
  expect(model.blockAttrs.length, `INV-1 위반 [${label}]`).toBe(blocks.length);
}

// INV-4 보조: markRuns.length === 블록 수, 각 블록 run.len 합 === 블록 글자 수
function assertINV4(model: DocModel, label: string) {
  const parts = model.buffer.split("\n");
  expect(model.markRuns.length, `INV-4 길이 위반 [${label}]`).toBe(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const expected = parts[i]?.length ?? 0;
    const actual = (model.markRuns[i] ?? []).reduce((s, r) => s + r.len, 0);
    expect(actual, `INV-4 블록${i} len 합 위반 [${label}]`).toBe(expected);
  }
}

// INV-5 보조: 모든 블록 run-list 가 정규형
function assertINV5(model: DocModel, label: string) {
  for (let i = 0; i < model.markRuns.length; i++) {
    const runs = model.markRuns[i] ?? [];
    for (const r of runs) {
      expect(r.len, `INV-5 len>0 위반 블록${i} [${label}]`).toBeGreaterThan(0);
    }
    for (let j = 1; j < runs.length; j++) {
      expect(runs[j - 1]!.mask, `INV-5 인접 동일 mask 위반 블록${i} [${label}]`).not.toBe(
        runs[j]!.mask,
      );
    }
  }
}

// 초기 모델 생성 헬퍼 (markRuns 포함)
function makeModel(buffer: string, attrs?: BlockAttr[], markRuns?: MarkRun[][]): DocModel {
  const blocks = buffer.split("\n");
  const blockAttrs: BlockAttr[] = attrs ?? blocks.map(() => ({ type: "paragraph" as const }));
  const runs: MarkRun[][] =
    markRuns ??
    blocks.map((seg) => (seg.length === 0 ? [] : [{ len: seg.length, mask: 0 }]));
  return { buffer, blockAttrs, markRuns: runs };
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
      markRuns: [[{ len: 1, mask: 0 }]],
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
      markRuns: [
        [{ len: 1, mask: 0 }],
        [{ len: 1, mask: 0 }],
        [],
        [],
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
// toggleHeading — T015
// ─────────────────────────────────────────
describe("toggleHeading", () => {
  it("paragraph → heading(level) 로 변환", () => {
    const m = makeModel("안녕\n세계");
    const result = toggleHeading(m, 0, 1);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 1 });
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    assertINV1(result, "paragraph→heading");
  });

  it("heading 같은 level → paragraph 로 토글 해제", () => {
    const m = makeModel("제목", [{ type: "heading", level: 2 }]);
    const result = toggleHeading(m, 0, 2);
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    assertINV1(result, "heading 같은 level 토글 해제");
  });

  it("heading 다른 level → 새 level 로 변환", () => {
    const m = makeModel("제목", [{ type: "heading", level: 1 }]);
    const result = toggleHeading(m, 0, 3);
    expect(result.blockAttrs[0]).toEqual({ type: "heading", level: 3 });
    assertINV1(result, "heading 다른 level");
  });

  it("buffer 는 불변 — buffer 내용 그대로", () => {
    const m = makeModel("제목\n본문");
    const result = toggleHeading(m, 0, 2);
    expect(result.buffer).toBe(m.buffer);
    expect(result.buffer).toBe("제목\n본문");
  });

  it("INV-1: blockAttrs 길이는 블록 수와 동일", () => {
    const m = makeModel("a\nb\nc");
    const result = toggleHeading(m, 1, 2);
    assertINV1(result, "INV-1 유지");
  });

  it("INV-2: 결과 blockAttr 의 heading level 은 1|2|3", () => {
    const m = makeModel("a\nb");
    const result = toggleHeading(m, 0, 3);
    const attr = result.blockAttrs[0];
    expect(attr.type).toBe("heading");
    if (attr.type === "heading") {
      expect([1, 2, 3]).toContain(attr.level);
      expect(attr.level).toBe(3);
    }
  });

  it("범위 밖 blockIdx 이면 model 그대로 반환", () => {
    const m = makeModel("a\nb");
    const result = toggleHeading(m, 99, 1);
    expect(result).toBe(m); // 동일 참조
  });

  it("blockIdx 음수이면 model 그대로 반환", () => {
    const m = makeModel("a");
    const result = toggleHeading(m, -1, 1);
    expect(result).toBe(m);
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

// ─────────────────────────────────────────
// T003: blockRuns
// ─────────────────────────────────────────
describe("blockRuns — 정규형 run-list", () => {
  it("빈 블록 → []", () => {
    const m = makeModel("");
    expect(blockRuns(m, 0)).toEqual([]);
  });

  it("마크 없는 블록 → [{ len: 텍스트길이, mask: 0 }]", () => {
    const m = makeModel("hello");
    expect(blockRuns(m, 0)).toEqual([{ len: 5, mask: 0 }]);
  });

  it("인접 동일 mask 병합", () => {
    const m: DocModel = {
      buffer: "abc",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 1, mask: 1 }, { len: 2, mask: 1 }]], // 인접 동일 → 병합
    };
    expect(blockRuns(m, 0)).toEqual([{ len: 3, mask: 1 }]);
  });

  it("0길이 run 제거", () => {
    const m: DocModel = {
      buffer: "ab",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 0, mask: 1 }, { len: 2, mask: 0 }]],
    };
    expect(blockRuns(m, 0)).toEqual([{ len: 2, mask: 0 }]);
  });

  it("여러 다른 mask run — 그대로 반환", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }]],
    };
    expect(blockRuns(m, 0)).toEqual([{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }]);
  });
});

// ─────────────────────────────────────────
// T005: toggleMark
// ─────────────────────────────────────────
describe("toggleMark", () => {
  it("마크 없는 구간에 bold 적용 → 전체 bold", () => {
    const m = makeModel("hello");
    const result = toggleMark(m, 0, 5, MARK.bold);
    expect(blockRuns(result, 0)).toEqual([{ len: 5, mask: MARK.bold }]);
    assertINV4(result, "bold 적용");
    assertINV5(result, "bold 적용");
  });

  it("전부 bold 구간에 toggle → bold 해제(mask 0)", () => {
    const m: DocModel = {
      buffer: "hello",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 5, mask: MARK.bold }]],
    };
    const result = toggleMark(m, 0, 5, MARK.bold);
    expect(blockRuns(result, 0)).toEqual([{ len: 5, mask: 0 }]);
  });

  it("부분 bold 구간에 toggle → 전체 bold 적용 (일부 없으면 SET)", () => {
    const m: DocModel = {
      buffer: "hello",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }]],
    };
    const result = toggleMark(m, 0, 5, MARK.bold);
    expect(blockRuns(result, 0)).toEqual([{ len: 5, mask: MARK.bold }]);
  });

  it("구간 경계: 중간 일부만 bold", () => {
    const m = makeModel("hello world");
    const result = toggleMark(m, 6, 11, MARK.bold);
    // "hello "(0~5 mask0) + "world"(6~11 bold)
    expect(blockRuns(result, 0)).toEqual([
      { len: 6, mask: 0 },
      { len: 5, mask: MARK.bold },
    ]);
  });

  it("여러 run 횡단 toggle — 정규화 확인", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 1, mask: 0 }, { len: 2, mask: MARK.bold }]],
    };
    // 전부 bold 있음? 아니(중간 mask0) → bold 적용
    const result = toggleMark(m, 0, 5, MARK.bold);
    expect(blockRuns(result, 0)).toEqual([{ len: 5, mask: MARK.bold }]);
  });

  it("전부 bold 인 여러 run → toggle 해제 후 정규화", () => {
    const m: DocModel = {
      buffer: "abc",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 1, mask: MARK.bold }, { len: 2, mask: MARK.bold }]],
    };
    const result = toggleMark(m, 0, 3, MARK.bold);
    // bold 해제 → [{ len:3, mask:0 }] (병합)
    expect(blockRuns(result, 0)).toEqual([{ len: 3, mask: 0 }]);
  });

  it("bold + italic 복합 — italic toggle 시 bold 보존", () => {
    const m: DocModel = {
      buffer: "hi",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold | MARK.italic }]],
    };
    const result = toggleMark(m, 0, 2, MARK.italic);
    // italic 해제, bold 보존
    expect(blockRuns(result, 0)).toEqual([{ len: 2, mask: MARK.bold }]);
  });

  it("lo >= hi 이면 무변경", () => {
    const m = makeModel("abc");
    const result = toggleMark(m, 2, 2, MARK.bold);
    expect(result).toBe(m);
  });

  it("INV-4/5 유지", () => {
    const m = makeModel("안녕하세요");
    const result = toggleMark(m, 1, 4, MARK.underline);
    assertINV4(result, "toggleMark INV-4");
    assertINV5(result, "toggleMark INV-5");
  });
});

// ─────────────────────────────────────────
// T007: marksAt
// ─────────────────────────────────────────
describe("marksAt", () => {
  it("offset 0 → 블록 첫 글자(우측) mask", () => {
    const m: DocModel = {
      buffer: "abc",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 3, mask: MARK.bold }]],
    };
    expect(marksAt(m, 0)).toBe(MARK.bold);
  });

  it("중간 offset → 좌측 글자 mask", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }]],
    };
    // offset 2 = 좌측이 'b'(bold run 안) → MARK.bold
    expect(marksAt(m, 2)).toBe(MARK.bold);
    // offset 3 = 좌측이 'c'(mask0 run 안) → 0
    expect(marksAt(m, 3)).toBe(0);
  });

  it("블록 경계 시작 offset → 우측(다음 글자) mask", () => {
    const m: DocModel = {
      buffer: "ab\ncd",
      blockAttrs: [{ type: "paragraph" }, { type: "paragraph" }],
      markRuns: [
        [{ len: 2, mask: MARK.italic }],
        [{ len: 2, mask: MARK.bold }],
      ],
    };
    // offset 3 = 블록1 시작 → 우측 = bold
    expect(marksAt(m, 3)).toBe(MARK.bold);
  });

  it("빈 블록 → 0", () => {
    const m = makeModel("");
    expect(marksAt(m, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────
// T009: insertText markRuns 동기
// ─────────────────────────────────────────
describe("insertText — markRuns 동기", () => {
  it("마크 없는 삽입 — INV-4/5 유지", () => {
    const m = makeModel("hello");
    const result = insertText(m, 2, 2, "XY", 0);
    expect(result.buffer).toBe("heXYllo");
    assertINV4(result, "삽입 INV-4");
    assertINV5(result, "삽입 INV-5");
  });

  it("bold mask 로 삽입 — 삽입분이 bold run", () => {
    const m = makeModel("ac"); // [mask0: len2]
    const result = insertText(m, 1, 1, "b", MARK.bold);
    // "abc" = a(mask0,1) + b(bold,1) + c(mask0,1) → 정규형 3 run
    expect(result.buffer).toBe("abc");
    const runs = blockRuns(result, 0);
    expect(runs).toEqual([
      { len: 1, mask: 0 },
      { len: 1, mask: MARK.bold },
      { len: 1, mask: 0 },
    ]);
  });

  it("삭제 후 markRuns 경계 병합 — 정규화", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 1, mask: 0 }, { len: 2, mask: MARK.bold }]],
    };
    // 중간 mask0 글자 삭제 → bold 인접 → 병합
    const result = deleteRange(m, 2, 3);
    expect(result.buffer).toBe("abde");
    expect(blockRuns(result, 0)).toEqual([{ len: 4, mask: MARK.bold }]);
  });

  it("개행 포함 삽입 — 블록 분리 후 markRuns 분리", () => {
    const m: DocModel = {
      buffer: "abcd",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 2, mask: 0 }]],
    };
    // "ab|cd" → "ab\ncd"
    const result = insertText(m, 2, 2, "\n", 0);
    expect(result.buffer).toBe("ab\ncd");
    // 블록0: "ab" bold, 블록1: "cd" mask0
    expect(blockRuns(result, 0)).toEqual([{ len: 2, mask: MARK.bold }]);
    expect(blockRuns(result, 1)).toEqual([{ len: 2, mask: 0 }]);
    assertINV4(result, "개행 삽입 분리");
    assertINV5(result, "개행 삽입 분리");
  });

  it("다블록 걸친 삭제 — markRuns 병합 후 정규화", () => {
    const m: DocModel = {
      buffer: "ab\ncd",
      blockAttrs: [{ type: "paragraph" }, { type: "paragraph" }],
      markRuns: [
        [{ len: 2, mask: MARK.bold }],
        [{ len: 2, mask: MARK.bold }],
      ],
    };
    // 개행 삭제 → 단일 블록
    const result = deleteRange(m, 2, 3);
    expect(result.buffer).toBe("abcd");
    expect(blockRuns(result, 0)).toEqual([{ len: 4, mask: MARK.bold }]);
  });
});

// ─────────────────────────────────────────
// T011: splitBlock/mergeWithPrev/mergeWithNext markRuns 추종
// ─────────────────────────────────────────
describe("splitBlock — markRuns 분할", () => {
  it("중간 분할 — 앞/뒤 블록 run-list 분리", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 3, mask: 0 }]],
    };
    const result = splitBlock(m, 2);
    // 블록0: "ab" bold, 블록1: "cde" mask0
    expect(blockRuns(result, 0)).toEqual([{ len: 2, mask: MARK.bold }]);
    expect(blockRuns(result, 1)).toEqual([{ len: 3, mask: 0 }]);
    assertINV4(result, "splitBlock INV-4");
    assertINV5(result, "splitBlock INV-5");
  });

  it("run 중간 분할 — run 쪼개짐", () => {
    const m: DocModel = {
      buffer: "abcde",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 5, mask: MARK.bold }]],
    };
    const result = splitBlock(m, 3);
    expect(blockRuns(result, 0)).toEqual([{ len: 3, mask: MARK.bold }]);
    expect(blockRuns(result, 1)).toEqual([{ len: 2, mask: MARK.bold }]);
  });
});

describe("mergeWithPrev — markRuns 이어붙임", () => {
  it("두 블록 병합 — run-list 이어붙임 후 정규화", () => {
    const m: DocModel = {
      buffer: "ab\ncd",
      blockAttrs: [{ type: "paragraph" }, { type: "paragraph" }],
      markRuns: [
        [{ len: 2, mask: MARK.bold }],
        [{ len: 2, mask: 0 }],
      ],
    };
    const result = mergeWithPrev(m, 1);
    expect(result.buffer).toBe("abcd");
    // bold(2) + mask0(2) → 다른 mask → 정규형 2 run
    expect(blockRuns(result, 0)).toEqual([
      { len: 2, mask: MARK.bold },
      { len: 2, mask: 0 },
    ]);
  });

  it("같은 mask 이어붙임 → 병합", () => {
    const m: DocModel = {
      buffer: "ab\ncd",
      blockAttrs: [{ type: "paragraph" }, { type: "paragraph" }],
      markRuns: [
        [{ len: 2, mask: MARK.bold }],
        [{ len: 2, mask: MARK.bold }],
      ],
    };
    const result = mergeWithPrev(m, 1);
    expect(blockRuns(result, 0)).toEqual([{ len: 4, mask: MARK.bold }]);
  });
});

// ─────────────────────────────────────────
// INV-4/5 가드 (전체 연산)
// ─────────────────────────────────────────
describe("INV-4/5 — 전체 연산 불변식", () => {
  const base: DocModel = {
    buffer: "hello\nworld",
    blockAttrs: [{ type: "paragraph" }, { type: "paragraph" }],
    markRuns: [
      [{ len: 3, mask: MARK.bold }, { len: 2, mask: 0 }],
      [{ len: 5, mask: MARK.italic }],
    ],
  };

  it("toggleMark — INV-4/5", () => {
    const r = toggleMark(base, 0, 5, MARK.bold);
    assertINV4(r, "toggleMark INV-4");
    assertINV5(r, "toggleMark INV-5");
  });

  it("insertText — INV-4/5", () => {
    const r = insertText(base, 3, 3, "X", MARK.bold);
    assertINV4(r, "insertText INV-4");
    assertINV5(r, "insertText INV-5");
  });

  it("deleteRange — INV-4/5", () => {
    const r = deleteRange(base, 2, 7);
    assertINV4(r, "deleteRange INV-4");
    assertINV5(r, "deleteRange INV-5");
  });

  it("splitBlock — INV-4/5", () => {
    const r = splitBlock(base, 3);
    assertINV4(r, "splitBlock INV-4");
    assertINV5(r, "splitBlock INV-5");
  });

  it("mergeWithPrev — INV-4/5", () => {
    const r = mergeWithPrev(base, 1);
    assertINV4(r, "mergeWithPrev INV-4");
    assertINV5(r, "mergeWithPrev INV-5");
  });

  it("mergeWithNext — INV-4/5", () => {
    const r = mergeWithNext(base, 0);
    assertINV4(r, "mergeWithNext INV-4");
    assertINV5(r, "mergeWithNext INV-5");
  });
});

// ─────────────────────────────────────────
// lineIndexFor (T029/T030) — wrap 경계 affinity 줄 선택 산술
//   2줄 블록: line[0]={start:0,end:5}, line[1]={start:5,end:10}. 경계 offset = 5.
// ─────────────────────────────────────────
describe("lineIndexFor — affinity 기반 시각 줄 선택", () => {
  const lines = [
    { start: 0, end: 5 },
    { start: 5, end: 10 },
  ];

  it("downstream(+1)은 경계 offset 을 다음 줄 머리로 — 1라운드 동작 보존", () => {
    expect(lineIndexFor(lines, 5, 1)).toBe(1);
  });

  it("upstream(-1)은 경계 offset 을 앞 줄 끝으로", () => {
    expect(lineIndexFor(lines, 5, -1)).toBe(0);
  });

  it("경계가 아닌 offset 은 affinity 무관 같은 줄", () => {
    expect(lineIndexFor(lines, 3, 1)).toBe(0);
    expect(lineIndexFor(lines, 3, -1)).toBe(0);
    expect(lineIndexFor(lines, 7, 1)).toBe(1);
    expect(lineIndexFor(lines, 7, -1)).toBe(1);
  });

  it("줄 시작(0) offset 은 두 affinity 모두 첫 줄", () => {
    expect(lineIndexFor(lines, 0, 1)).toBe(0);
    expect(lineIndexFor(lines, 0, -1)).toBe(0);
  });

  it("맨 끝 offset(=마지막 줄 end)은 downstream 도 마지막 줄 fallback", () => {
    expect(lineIndexFor(lines, 10, 1)).toBe(1);
    expect(lineIndexFor(lines, 10, -1)).toBe(1);
  });

  it("빈 lines 는 -1", () => {
    expect(lineIndexFor([], 0, 1)).toBe(-1);
    expect(lineIndexFor([], 0, -1)).toBe(-1);
  });
});

// ─────────────────────────────────────────
// T003/T007: isAtomic
// ─────────────────────────────────────────
describe("isAtomic", () => {
  it("hr → true", () => {
    expect(isAtomic({ type: "hr" })).toBe(true);
  });

  it("paragraph → false", () => {
    expect(isAtomic({ type: "paragraph" })).toBe(false);
  });

  it("heading → false", () => {
    expect(isAtomic({ type: "heading", level: 1 })).toBe(false);
  });

  it("blockquote → false", () => {
    expect(isAtomic({ type: "blockquote" })).toBe(false);
  });

  it("listItem → false", () => {
    expect(isAtomic({ type: "listItem", listKind: "bullet", depth: 0 })).toBe(false);
  });
});

// ─────────────────────────────────────────
// T008/T009: listNumberAt
// ─────────────────────────────────────────
describe("listNumberAt", () => {
  it("ordered listItem 첫 번째 → 1", () => {
    const m = makeModel("항목1", [{ type: "listItem", listKind: "ordered", depth: 0 }]);
    expect(listNumberAt(m, 0)).toBe(1);
  });

  it("연속 ordered listItem → 2-based 번호", () => {
    const m = makeModel("항목1\n항목2\n항목3", [
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    expect(listNumberAt(m, 0)).toBe(1);
    expect(listNumberAt(m, 1)).toBe(2);
    expect(listNumberAt(m, 2)).toBe(3);
  });

  it("중간에 paragraph 끼면 재시작", () => {
    const m = makeModel("a\nb\nc", [
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "paragraph" },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    expect(listNumberAt(m, 0)).toBe(1);
    expect(listNumberAt(m, 2)).toBe(1);
  });

  it("다른 depth 끼면 재시작", () => {
    const m = makeModel("a\nb\nc", [
      { type: "listItem", listKind: "ordered", depth: 0 },
      { type: "listItem", listKind: "ordered", depth: 1 },
      { type: "listItem", listKind: "ordered", depth: 0 },
    ]);
    expect(listNumberAt(m, 0)).toBe(1);
    expect(listNumberAt(m, 2)).toBe(1); // depth 1이 끼어 재시작
  });

  it("bullet listItem → null", () => {
    const m = makeModel("항목", [{ type: "listItem", listKind: "bullet", depth: 0 }]);
    expect(listNumberAt(m, 0)).toBeNull();
  });

  it("paragraph → null", () => {
    const m = makeModel("본문");
    expect(listNumberAt(m, 0)).toBeNull();
  });
});

// ─────────────────────────────────────────
// T004/T005: toggleBlockType
// ─────────────────────────────────────────
describe("toggleBlockType", () => {
  it("paragraph → blockquote: 텍스트 보존, type 변경", () => {
    const m = makeModel("안녕");
    const result = toggleBlockType(m, 0, "blockquote");
    expect(result.blockAttrs[0]).toEqual({ type: "blockquote" });
    expect(result.buffer).toBe("안녕");
    assertINV1(result, "paragraph→blockquote");
    assertINV4(result, "paragraph→blockquote");
  });

  it("blockquote → paragraph", () => {
    const m = makeModel("인용", [{ type: "blockquote" }]);
    const result = toggleBlockType(m, 0, "paragraph");
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    expect(result.buffer).toBe("인용");
  });

  it("paragraph → bullet listItem: depth=0", () => {
    const m = makeModel("항목");
    const result = toggleBlockType(m, 0, { listKind: "bullet" });
    expect(result.blockAttrs[0]).toEqual({ type: "listItem", listKind: "bullet", depth: 0 });
    expect(result.buffer).toBe("항목");
  });

  it("paragraph → ordered listItem: depth=0", () => {
    const m = makeModel("항목");
    const result = toggleBlockType(m, 0, { listKind: "ordered" });
    expect(result.blockAttrs[0]).toEqual({ type: "listItem", listKind: "ordered", depth: 0 });
  });

  it("listItem → paragraph: depth 제거", () => {
    const m = makeModel("항목", [{ type: "listItem", listKind: "bullet", depth: 2 }]);
    const result = toggleBlockType(m, 0, "paragraph");
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
  });

  it("markRuns 보존", () => {
    const m: DocModel = {
      buffer: "abc",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 1, mask: 0 }]],
    };
    const result = toggleBlockType(m, 0, "blockquote");
    expect(result.markRuns[0]).toEqual([{ len: 2, mask: MARK.bold }, { len: 1, mask: 0 }]);
  });

  it("INV-1/4/5 유지", () => {
    const m = makeModel("안녕\n세계");
    const result = toggleBlockType(m, 1, { listKind: "ordered" });
    assertINV1(result, "toggleBlockType INV-1");
    assertINV4(result, "toggleBlockType INV-4");
    assertINV5(result, "toggleBlockType INV-5");
  });
});

// ─────────────────────────────────────────
// T006/T007: insertHr / deleteAtomicAt / nextCaretSkippingAtomic
// ─────────────────────────────────────────
describe("insertHr", () => {
  it("단일 블록 중간에 hr 삽입 → 3블록(앞/hr/뒤), INV-6", () => {
    const m = makeModel("앞뒤");
    const result = insertHr(m, 1); // "앞" 다음에 hr 삽입
    // buffer: "앞\n\n뒤" (앞 블록 분리 + hr 빈 세그먼트 + 뒤 블록)
    const parts = result.buffer.split("\n");
    expect(parts).toHaveLength(3);
    expect(result.blockAttrs[1]).toEqual({ type: "hr" });
    // INV-6: hr 블록 세그먼트 = ""
    expect(parts[1]).toBe("");
    // INV-6: hr markRuns = []
    expect(result.markRuns[1]).toEqual([]);
    assertINV1(result, "insertHr 3블록");
    assertINV4(result, "insertHr INV-4");
  });

  it("버퍼 시작(offset=0)에 hr 삽입 → 앞 빈 블록+hr+뒤 블록 3개", () => {
    const m = makeModel("본문");
    const result = insertHr(m, 0);
    // buffer: "\n\n본문" → ["", "", "본문"]
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" }); // 빈 앞 블록
    expect(result.blockAttrs[1]).toEqual({ type: "hr" });
    expect(result.blockAttrs[2]).toEqual({ type: "paragraph" });
    assertINV1(result, "insertHr 시작");
  });

  it("버퍼 끝(offset=len)에 hr 삽입 → 앞 블록+hr+빈 뒤 블록", () => {
    const m = makeModel("본문");
    const result = insertHr(m, 2);
    // buffer: "본문\n\n" → ["본문", "", ""]
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    expect(result.blockAttrs[1]).toEqual({ type: "hr" });
    expect(result.blockAttrs[2]).toEqual({ type: "paragraph" }); // 빈 뒤 블록
    assertINV1(result, "insertHr 끝");
  });
});

describe("deleteAtomicAt", () => {
  it("hr 블록 삭제 → 인접 블록 잔존, 블록 수 감소", () => {
    const m = makeModel("앞\n\n뒤", [
      { type: "paragraph" },
      { type: "hr" },
      { type: "paragraph" },
    ]);
    const result = deleteAtomicAt(m, 1);
    expect(result.blockAttrs).toHaveLength(2);
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    expect(result.blockAttrs[1]).toEqual({ type: "paragraph" });
    assertINV1(result, "deleteAtomicAt");
    assertINV4(result, "deleteAtomicAt INV-4");
  });

  it("hr이 아닌 블록 삭제 시도 → 무변경", () => {
    const m = makeModel("본문");
    const result = deleteAtomicAt(m, 0);
    expect(result).toBe(m);
  });
});

describe("nextCaretSkippingAtomic", () => {
  // buffer: "앞\n\n뒤" (블록0=paragraph, 블록1=hr, 블록2=paragraph)
  // blockRanges: [{start:0,end:2}, {start:2,end:3}, {start:3,end:4}]
  // offset 매핑: 0="앞"시작, 1="앞"끝(블록0 텍스트 끝), 2=블록1(hr)시작/끝(빈), 3="뒤"시작
  const m = makeModel("앞\n\n뒤", [
    { type: "paragraph" },
    { type: "hr" },
    { type: "paragraph" },
  ]);

  it("dir=+1: hr 직전에서 hr 건너뜀 → 다음 블록 시작", () => {
    // 블록0 끝(offset=1) → dir=+1 → next=2(hr 블록) → hr 건너뜀 → 블록2 시작 = 3
    const result = nextCaretSkippingAtomic(m, 1, 1);
    expect(result).toBe(3);
  });

  it("dir=-1: hr 직후에서 hr 건너뜀 → 이전 블록 끝", () => {
    // 블록2 시작(offset=3) → dir=-1 → next=2(hr 블록) → hr 건너뜀 → 블록0 텍스트 끝 = 1
    const result = nextCaretSkippingAtomic(m, 3, -1);
    expect(result).toBe(1);
  });

  it("hr 없을 때는 일반 인접 offset 반환", () => {
    const m2 = makeModel("abc");
    expect(nextCaretSkippingAtomic(m2, 1, 1)).toBe(2);
    expect(nextCaretSkippingAtomic(m2, 2, -1)).toBe(1);
  });

  it("이미 첫 위치에서 dir=-1 → 0", () => {
    const m2 = makeModel("abc");
    expect(nextCaretSkippingAtomic(m2, 0, -1)).toBe(0);
  });

  it("이미 마지막 위치에서 dir=+1 → 유지", () => {
    const m2 = makeModel("abc");
    expect(nextCaretSkippingAtomic(m2, 3, 1)).toBe(3);
  });
});

// ─────────────────────────────────────────
// T010: splitBlock 확장 — 목록 항목
// ─────────────────────────────────────────
describe("splitBlock — 목록 항목 확장", () => {
  it("bullet listItem 분할 → 새 블록도 같은 listKind·depth", () => {
    const m = makeModel("항목", [{ type: "listItem", listKind: "bullet", depth: 0 }]);
    const result = splitBlock(m, 2); // "항목" 뒤에서 분리
    expect(result.blockAttrs[0]).toEqual({ type: "listItem", listKind: "bullet", depth: 0 });
    expect(result.blockAttrs[1]).toEqual({ type: "listItem", listKind: "bullet", depth: 0 });
    assertINV1(result, "bullet listItem 분할");
  });

  it("ordered listItem 분할 → 새 블록도 같은 listKind·depth", () => {
    const m = makeModel("항목", [{ type: "listItem", listKind: "ordered", depth: 1 }]);
    const result = splitBlock(m, 2);
    expect(result.blockAttrs[0]).toEqual({ type: "listItem", listKind: "ordered", depth: 1 });
    expect(result.blockAttrs[1]).toEqual({ type: "listItem", listKind: "ordered", depth: 1 });
  });

  it("빈 bullet listItem 에서 splitBlock → paragraph 강등", () => {
    const m = makeModel("", [{ type: "listItem", listKind: "bullet", depth: 0 }]);
    const result = splitBlock(m, 0);
    // 빈 listItem에서 Enter → paragraph로 강등(빈 목록 항목 종료)
    // 결과: 빈 paragraph 블록
    expect(result.blockAttrs[0]).toEqual({ type: "paragraph" });
    assertINV1(result, "빈 listItem 강등");
  });

  it("빈 ordered listItem 에서 splitBlock → paragraph 강등", () => {
    const m2 = makeModel("", [{ type: "listItem", listKind: "ordered", depth: 0 }]);
    const r2 = splitBlock(m2, 0);
    expect(r2.blockAttrs[0]).toEqual({ type: "paragraph" });
  });
});

// ─────────────────────────────────────────
// T016/T017: insertSoftBreak
// ─────────────────────────────────────────
describe("insertSoftBreak", () => {
  it("U+2028 삽입 후 블록 수 불변", () => {
    const m = makeModel("hello");
    const result = insertSoftBreak(m, 2);
    // buffer에 U+2028이 삽입되어도 개행이 생기지 않아 블록 1개 유지
    expect(result.buffer.split("\n")).toHaveLength(1);
    expect(result.blockAttrs).toHaveLength(1);
    assertINV1(result, "insertSoftBreak 블록 수 불변");
  });

  it("U+2028이 buffer에 삽입됨", () => {
    const m = makeModel("hello");
    const result = insertSoftBreak(m, 2);
    expect(result.buffer).toBe("he" + SOFT_BREAK + "llo");
  });

  it("INV-4 유지 — U+2028 1글자 카운트", () => {
    const m = makeModel("abc");
    const result = insertSoftBreak(m, 1);
    // U+2028 삽입 후 블록0 글자 수 = 4
    assertINV4(result, "insertSoftBreak INV-4");
    const totalLen = (result.markRuns[0] ?? []).reduce((s, r) => s + r.len, 0);
    expect(totalLen).toBe(4);
  });

  it("markRuns 정합 — 삽입 위치 run len +1", () => {
    const m: DocModel = {
      buffer: "abcd",
      blockAttrs: [{ type: "paragraph" }],
      markRuns: [[{ len: 2, mask: MARK.bold }, { len: 2, mask: 0 }]],
    };
    const result = insertSoftBreak(m, 2); // "ab" 뒤에 삽입
    // U+2028 삽입 후 블록0 글자 수 = 4
    // 실제로는 삽입 위치가 bold run 끝 = mask0으로 삽입
    assertINV4(result, "insertSoftBreak markRuns");
    assertINV5(result, "insertSoftBreak markRuns INV-5");
  });

  it("다중 블록에서 U+2028 삽입 시 해당 블록만 변경", () => {
    const m = makeModel("안녕\n세계");
    const result = insertSoftBreak(m, 0); // 블록0 시작에 삽입
    expect(result.buffer.split("\n")).toHaveLength(2);
    assertINV1(result, "다중 블록 softBreak");
    assertINV4(result, "다중 블록 softBreak INV-4");
  });
});

// ─────────────────────────────────────────
// T018/T019: U+2028 인접 Backspace 삭제·캐럿 이동
// ─────────────────────────────────────────
describe("U+2028 인접 Backspace 삭제·캐럿 이동", () => {
  it("U+2028 오른쪽에서 Backspace(deleteRange) → U+2028 제거, 블록 수 불변", () => {
    // "a U+2028 b" 에서 U+2028 오른쪽(offset=2)에서 backspace → [1,2) 제거
    const SOFT = SOFT_BREAK;
    const m = makeModel("a" + SOFT + "b");
    // buffer: "aSb" (S=U+2028), 길이 3, 블록 1개
    const result = deleteRange(m, 1, 2); // U+2028 삭제
    expect(result.buffer).toBe("ab");
    expect(result.buffer.split("\n")).toHaveLength(1);
    assertINV1(result, "softBreak backspace");
    assertINV4(result, "softBreak backspace INV-4");
  });

  it("U+2028 왼쪽에서 Delete(deleteRange) → U+2028 제거", () => {
    const SOFT = SOFT_BREAK;
    const m = makeModel("a" + SOFT + "b");
    const result = deleteRange(m, 1, 2);
    expect(result.buffer).toBe("ab");
  });

  it("U+2028 삽입 후 삭제 왕복 → 원본 복원", () => {
    const m = makeModel("hello world");
    const withSoft = insertSoftBreak(m, 5);
    const restored = deleteRange(withSoft, 5, 6);
    expect(restored.buffer).toBe("hello world");
    assertINV4(restored, "softBreak 삽입→삭제 왕복");
  });

  it("nextCaretSkippingAtomic은 U+2028을 건너뜀 없이 정상 이동 (U+2028은 비원자)", () => {
    const SOFT = SOFT_BREAK;
    const m = makeModel("a" + SOFT + "b");
    // U+2028이 원자 블록 아님 → nextCaretSkippingAtomic이 그냥 통과
    const result = nextCaretSkippingAtomic(m, 0, 1);
    expect(result).toBe(1); // offset+1 = 1 (U+2028 위치)
  });
});
