/**
 * 자체 에디터 내부 문서 모델 (순수 함수, 불변)
 *
 * 불변식:
 *   INV-1: blockAttrs.length === buffer.split('\n').length
 *   INV-2: heading 이면 level ∈ {1, 2, 3}
 *   INV-3: 빈 모델 = { buffer: '', blockAttrs: [{ type: 'paragraph' }], markRuns: [[]] }
 *   INV-4: markRuns.length === blockAttrs.length (블록 수 일치)
 *          각 블록 run.len 합 === 블록 글자 수 (개행 제외)
 *   INV-5: 정규형 — 모든 블록 run-list 가 정규형(인접 동일 mask 없음, len>0)
 *
 * 경계 규약 (blockIndexAt):
 *   개행 문자('\n') 자체는 이전 블록의 끝으로 귀속.
 *   즉, 오프셋 k 가 '\n' 이면 그 블록 인덱스 = '\n' 앞 블록.
 */

export type BlockAttr =
  | { type: "paragraph" }
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "blockquote" }
  | { type: "listItem"; listKind: "bullet" | "ordered"; depth: number } // depth ≥ 0
  | { type: "hr" };

/**
 * 블록 내 소프트 줄바꿈 마커 (U+2028 LINE SEPARATOR).
 * 블록 경계('\n')와 구분 — blockRanges 는 '\n' 으로만 블록을 나눈다.
 * Shift+Enter 입력·hardBreak 노드 왕복에 쓰인다.
 */
export const SOFT_BREAK = "\u2028";

// ─────────────────────────────────────────
// 마크 타입 (T002)
// ─────────────────────────────────────────

export const MARK = { bold: 1, italic: 2, underline: 4, strike: 8 } as const;
export type Mask = number;
export type MarkRun = { len: number; mask: Mask }; // len > 0

export type DocModel = {
  buffer: string;
  blockAttrs: BlockAttr[];
  markRuns: MarkRun[][]; // 블록별 run-list. 길이 = 블록 수.
};

// ─────────────────────────────────────────
// 캐럿 affinity (T029)
//   soft-wrap 경계 offset(line[K].start === line[K-1].end)은 "앞 줄 끝"·"다음 줄 시작" 두
//   시각 위치를 가진다. affinity 로 정식 구분:
//     -1 = upstream  (앞 줄 끝)
//     +1 = downstream(다음 줄 시작) — 기본값. 1라운드 동작 = +1 이라 기본 +1 이 무회귀.
// ─────────────────────────────────────────
export type Affinity = -1 | 1;
export type Selection = { anchor: number; focus: number; affinity: Affinity };

/**
 * wrap 경계 offset 의 affinity 를 적용해 캐럿이 속할 시각 줄 인덱스를 고른다(순수).
 * - lines: 블록의 시각 줄들(각 {start, end}, end exclusive·다음 줄 start 와 동일).
 * - within: 블록 시작 기준 offset.
 * 규칙:
 *   +1(downstream): `within < l.end` 인 첫 줄(경계 offset 은 다음 줄 머리). 1라운드 동작 그대로.
 *   -1(upstream):   `within <= l.end` 인 첫 줄(경계 offset 은 앞 줄 끝).
 * 둘 다 매칭 실패(맨 끝) → 마지막 줄. lines 비면 -1(호출부가 처리).
 */
export function lineIndexFor(
  lines: ReadonlyArray<{ start: number; end: number }>,
  within: number,
  affinity: Affinity,
): number {
  if (lines.length === 0) return -1;
  const idx =
    affinity === -1
      ? lines.findIndex((l) => within <= l.end)
      : lines.findIndex((l) => within < l.end);
  return idx < 0 ? lines.length - 1 : idx;
}

// ─────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────

/**
 * buffer 를 블록으로 분리할 때 각 블록의 [start, end) 오프셋을 반환.
 * '\n' 은 이전 블록에 포함 (end 에 개행 포함).
 *
 * 예) "ab\ncd\nef"
 *   블록0: start=0, end=3  (포함: "ab\n")
 *   블록1: start=3, end=6  (포함: "cd\n")
 *   블록2: start=6, end=8  (포함: "ef")
 */
function blockRanges(buffer: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i <= buffer.length; i++) {
    if (i === buffer.length || buffer[i] === "\n") {
      // end 는 개행 포함 (이전 블록 끝 = 개행 위치)
      ranges.push({ start, end: i === buffer.length ? i : i + 1 });
      start = i + 1;
    }
  }
  // buffer 가 빈 문자열이면 블록 1개(빈 블록) — INV-3
  if (ranges.length === 0) {
    ranges.push({ start: 0, end: 0 });
  }
  return ranges;
}

// ─────────────────────────────────────────
// blockIndexAt
// ─────────────────────────────────────────

/**
 * offset 이 속한 블록 인덱스를 반환.
 *
 * 경계 규약: offset 이 '\n' 위치면 해당 '\n' 을 소유한 이전 블록(blockRanges 의 end-1).
 * 즉 블록의 [start, end) 범위에 '\n' 포함이므로 offset < end 이면 그 블록.
 */
export function blockIndexAt(model: DocModel, offset: number): number {
  const ranges = blockRanges(model.buffer);
  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    // 마지막 블록은 end 포함 (buffer.length 도 마지막 블록)
    if (i === ranges.length - 1) {
      if (offset >= start) return i;
    } else {
      // '\n' 은 이전 블록 end-1 위치이므로 offset < end 이면 이 블록
      if (offset >= start && offset < end) return i;
    }
  }
  // fallback: 마지막 블록
  return ranges.length - 1;
}

// ─────────────────────────────────────────
// 마크 run-list 헬퍼 (T003)
// ─────────────────────────────────────────

/**
 * run-list 를 정규화한다: 인접 동일 mask 병합, 0길이 제거.
 */
function normalizeRuns(runs: MarkRun[]): MarkRun[] {
  const result: MarkRun[] = [];
  for (const run of runs) {
    if (run.len <= 0) continue;
    const last = result[result.length - 1];
    if (last && last.mask === run.mask) {
      result[result.length - 1] = { len: last.len + run.len, mask: last.mask };
    } else {
      result.push({ len: run.len, mask: run.mask });
    }
  }
  return result;
}

/**
 * 블록 텍스트 길이(개행 제외)를 반환.
 */
function blockTextLen(buffer: string, blockIdx: number): number {
  const parts = buffer.split("\n");
  return (parts[blockIdx] ?? "").length;
}

/**
 * 블록 i 의 정규형 run-list 를 반환 (T003).
 * 빈 블록 → [].
 */
export function blockRuns(model: DocModel, blockIdx: number): MarkRun[] {
  const runs = model.markRuns[blockIdx] ?? [];
  return normalizeRuns(runs);
}

// ─────────────────────────────────────────
// markRuns 초기화 헬퍼
// ─────────────────────────────────────────

/**
 * buffer + blockAttrs 에 맞는 빈 markRuns 를 생성.
 */
function emptyMarkRuns(buffer: string): MarkRun[][] {
  const parts = buffer.split("\n");
  return parts.map((seg) =>
    seg.length === 0 ? [] : [{ len: seg.length, mask: 0 }],
  );
}

// ─────────────────────────────────────────
// reconcile
// ─────────────────────────────────────────

/**
 * blockAttrs + markRuns 길이를 buffer 블록 수에 맞춤 (INV-1, INV-4 fallback).
 * - 부족분: blockAttrs → { type: 'paragraph' }, markRuns → 블록 크기에 맞는 빈 run
 * - 초과분: 절단
 *
 * 1라운드 reconcileAttrs 확장.
 */
export function reconcileAttrs(model: DocModel): DocModel {
  const parts = model.buffer.split("\n");
  const blockCount = parts.length;
  const { blockAttrs, markRuns } = model;

  const attrsOk = blockAttrs.length === blockCount;
  const runsOk = markRuns.length === blockCount;

  if (attrsOk && runsOk) return model;

  // blockAttrs 보정
  let newAttrs: BlockAttr[];
  if (blockAttrs.length < blockCount) {
    const toAdd = blockCount - blockAttrs.length;
    const pad: BlockAttr[] = Array.from({ length: toAdd }, () => ({
      type: "paragraph" as const,
    }));
    newAttrs = [...blockAttrs, ...pad];
  } else {
    newAttrs = blockAttrs.slice(0, blockCount);
  }

  // markRuns 보정
  let newRuns: MarkRun[][];
  if (markRuns.length < blockCount) {
    const toAdd = blockCount - markRuns.length;
    const pad: MarkRun[][] = Array.from({ length: toAdd }, (_, k) => {
      const segLen = parts[markRuns.length + k]?.length ?? 0;
      return segLen === 0 ? [] : [{ len: segLen, mask: 0 }];
    });
    newRuns = [...markRuns, ...pad];
  } else {
    newRuns = markRuns.slice(0, blockCount);
  }

  // run.len 합 보정 (INV-4 각 블록 len 합 === 블록 글자 수)
  newRuns = newRuns.map((runs, i) => {
    const expected = parts[i]?.length ?? 0;
    const actual = runs.reduce((s, r) => s + r.len, 0);
    if (actual === expected) return runs;
    // 불일치면 블록 전체를 mask 0 으로 덮음
    return expected === 0 ? [] : [{ len: expected, mask: 0 }];
  });

  return { buffer: model.buffer, blockAttrs: newAttrs, markRuns: newRuns };
}

// ─────────────────────────────────────────
// toggleMark (T005)
// ─────────────────────────────────────────

/**
 * [lo, hi) 전체에 mark 비트가 있으면 해제, 아니면 적용. 결과 정규화.
 */
export function toggleMark(model: DocModel, lo: number, hi: number, mark: Mask): DocModel {
  if (lo >= hi) return model;

  // 1. [lo,hi) 전부 mark 비트 여부 확인
  const allHave = _checkAllHaveMark(model, lo, hi, mark);

  // 2. 적용 또는 해제
  const newMarkRuns = _applyMaskChange(model, lo, hi, mark, allHave ? "clear" : "set");

  return reconcileAttrs({ ...model, markRuns: newMarkRuns });
}

/**
 * [lo, hi) 전체 글자가 mark 비트를 보유하는지 확인.
 */
function _checkAllHaveMark(model: DocModel, lo: number, hi: number, mark: Mask): boolean {
  const ranges = blockRanges(model.buffer);
  for (let bi = 0; bi < ranges.length; bi++) {
    const { start, end } = ranges[bi];
    // 블록 텍스트 범위 (개행 제외)
    const textStart = start;
    const textEnd = end - (bi < ranges.length - 1 ? 1 : 0); // 개행 제외

    const overlapLo = Math.max(lo, textStart);
    const overlapHi = Math.min(hi, textEnd);
    if (overlapLo >= overlapHi) continue;

    // 이 블록의 run-list 에서 [overlapLo - textStart, overlapHi - textStart) 확인
    const localLo = overlapLo - textStart;
    const localHi = overlapHi - textStart;
    const runs = blockRuns(model, bi);
    if (!_runsAllHaveMark(runs, localLo, localHi, mark)) return false;
  }
  return true;
}

function _runsAllHaveMark(runs: MarkRun[], lo: number, hi: number, mark: Mask): boolean {
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.len;
    if (runEnd <= lo) { pos = runEnd; continue; }
    if (pos >= hi) break;
    const oLo = Math.max(pos, lo);
    const oHi = Math.min(runEnd, hi);
    if (oLo < oHi && !(run.mask & mark)) return false;
    pos = runEnd;
  }
  return true;
}

/**
 * [lo, hi) 에 mark 비트를 set 또는 clear.
 */
function _applyMaskChange(
  model: DocModel,
  lo: number,
  hi: number,
  mark: Mask,
  op: "set" | "clear",
): MarkRun[][] {
  const ranges = blockRanges(model.buffer);
  return model.markRuns.map((_, bi) => {
    const { start, end } = ranges[bi];
    const textStart = start;
    const textEnd = end - (bi < ranges.length - 1 ? 1 : 0);

    const overlapLo = Math.max(lo, textStart);
    const overlapHi = Math.min(hi, textEnd);

    const runs = blockRuns(model, bi);

    if (overlapLo >= overlapHi) return runs;

    const localLo = overlapLo - textStart;
    const localHi = overlapHi - textStart;

    return normalizeRuns(_applyRunMaskChange(runs, localLo, localHi, mark, op));
  });
}

function _applyRunMaskChange(
  runs: MarkRun[],
  lo: number,
  hi: number,
  mark: Mask,
  op: "set" | "clear",
): MarkRun[] {
  const result: MarkRun[] = [];
  let pos = 0;

  for (const run of runs) {
    const runEnd = pos + run.len;

    if (runEnd <= lo || pos >= hi) {
      // 겹침 없음
      result.push({ ...run });
      pos = runEnd;
      continue;
    }

    // 앞 부분 (변경 전)
    if (pos < lo) {
      result.push({ len: lo - pos, mask: run.mask });
    }

    // 겹치는 부분 — mask 변경
    const oLo = Math.max(pos, lo);
    const oHi = Math.min(runEnd, hi);
    const newMask = op === "set" ? run.mask | mark : run.mask & ~mark;
    result.push({ len: oHi - oLo, mask: newMask });

    // 뒷 부분 (변경 후)
    if (runEnd > hi) {
      result.push({ len: runEnd - hi, mask: run.mask });
    }

    pos = runEnd;
  }

  return result;
}

// ─────────────────────────────────────────
// marksAt (T007)
// ─────────────────────────────────────────

/**
 * offset 좌측 글자의 mask. offset 0 또는 블록 시작이면 우측 글자(없으면 0).
 */
export function marksAt(model: DocModel, offset: number): Mask {
  const ranges = blockRanges(model.buffer);
  const bi = blockIndexAt(model, offset);
  const { start, end } = ranges[bi];
  const textStart = start;
  const textEnd = end - (bi < ranges.length - 1 ? 1 : 0); // 개행 제외

  const runs = blockRuns(model, bi);
  if (runs.length === 0) return 0;

  const localOffset = offset - textStart;

  // offset 0 또는 블록 시작이면 우측(다음 글자) mask
  if (localOffset <= 0) {
    // 블록의 첫 run mask
    return runs[0]?.mask ?? 0;
  }

  // 좌측 글자: localOffset-1 위치의 run
  let pos = 0;
  for (const run of runs) {
    const runEnd = pos + run.len;
    if (localOffset > pos && localOffset <= runEnd) {
      return run.mask;
    }
    pos = runEnd;
  }

  // 블록 끝 — 마지막 run mask
  return runs[runs.length - 1]?.mask ?? 0;
}

// ─────────────────────────────────────────
// insertText (T009)
// ─────────────────────────────────────────

/**
 * [lo, hi) 선택을 text 로 치환. 새 DocModel 반환.
 * markRuns 동기: 삽입분 = mask run, 삭제분 제거, 경계 split/merge 후 정규화.
 */
export function insertText(
  model: DocModel,
  lo: number,
  hi: number,
  text: string,
  mask: Mask = 0,
): DocModel {
  const { buffer, blockAttrs, markRuns } = model;

  // lo 가 속한 블록 인덱스 → attr 보존 대상
  const startBlockIdx = blockIndexAt(model, lo);
  const startAttr = blockAttrs[startBlockIdx];

  // 새 buffer 생성
  const newBuffer = buffer.slice(0, lo) + text + buffer.slice(hi);
  const newBlocks = newBuffer.split("\n");
  const newBlockCount = newBlocks.length;

  // 제거된 '\n' 수
  const removedBlockCount = buffer.slice(lo, hi).split("\n").length - 1;
  // 삽입된 '\n' 수
  const insertedBlockCount = text.split("\n").length - 1;

  // 기존 attrs 재구성
  const prefixAttrs = blockAttrs.slice(0, startBlockIdx);
  const suffixAttrs = blockAttrs.slice(startBlockIdx + 1 + removedBlockCount);
  const insertedAttrs: BlockAttr[] = Array.from({ length: insertedBlockCount }, () => ({
    type: "paragraph" as const,
  }));
  const newAttrs: BlockAttr[] = [
    ...prefixAttrs,
    startAttr,
    ...insertedAttrs,
    ...suffixAttrs,
  ];

  // markRuns 재구성
  const newMarkRuns = _insertTextMarkRuns(
    buffer,
    markRuns,
    lo,
    hi,
    text,
    mask,
    startBlockIdx,
    removedBlockCount,
    newBlocks,
  );

  const draft: DocModel = { buffer: newBuffer, blockAttrs: newAttrs, markRuns: newMarkRuns };
  return reconcileAttrs(draft);
}

/**
 * insertText 의 markRuns 동기 로직.
 *
 * 알고리즘:
 * 1. 영향받는 블록들의 run-list 를 flat 텍스트 공간에 concatenate.
 *    이때 개행('\n')은 텍스트 공간에 없으므로 제외 — 블록 텍스트만 연결.
 * 2. [lo, hi) 에서 실제 텍스트 글자만 삭제한 flat 위치를 계산.
 *    개행은 buffer 에는 있지만 flat 텍스트에는 없으므로 변환 필요.
 * 3. 삽입 텍스트(개행 포함 가능)를 flat 공간에서 치환.
 * 4. 새 블록 길이 배열로 flat 을 재분할.
 */
function _insertTextMarkRuns(
  buffer: string,
  markRuns: MarkRun[][],
  lo: number,
  hi: number,
  text: string,
  mask: Mask,
  startBlockIdx: number,
  removedBlockCount: number,
  newBlocks: string[],
): MarkRun[][] {
  const ranges = blockRanges(buffer);

  // 영향받는 블록 범위
  const endBlockIdx = startBlockIdx + removedBlockCount;

  // 영향 전/후 블록들 (변경 없음)
  const prefix = markRuns.slice(0, startBlockIdx);
  const suffix = markRuns.slice(endBlockIdx + 1);

  // 영향 블록들의 run-list 를 flat 텍스트 공간에 concatenate
  // 각 블록의 텍스트 길이를 순서대로 기록 (offset 변환에 사용)
  const flatRuns: MarkRun[] = [];
  const blockTextLens: number[] = []; // 영향 블록들의 텍스트 길이 (개행 제외)

  for (let bi = startBlockIdx; bi <= endBlockIdx && bi < ranges.length; bi++) {
    const { start, end } = ranges[bi];
    const textEnd = bi < ranges.length - 1 ? end - 1 : end; // 개행 제외
    const blockLen = textEnd - start;
    blockTextLens.push(blockLen);

    const runs = normalizeRuns(markRuns[bi] ?? []);
    if (runs.length === 0 && blockLen > 0) {
      flatRuns.push({ len: blockLen, mask: 0 });
    } else {
      for (const r of runs) flatRuns.push({ ...r });
    }
  }

  // buffer offset → flat 텍스트 offset 변환
  // 개행 문자는 flat 에 없으므로, buffer 의 텍스트 글자만 카운트
  function bufferToFlat(bufOffset: number): number {
    let flat = 0;
    let accBlockStart = 0; // 영향 블록 내 flat 텍스트 누적 offset
    for (let k = 0; k < blockTextLens.length; k++) {
      const bi = startBlockIdx + k;
      const { start, end } = ranges[bi];
      const textEnd = bi < ranges.length - 1 ? end - 1 : end;

      if (bufOffset <= textEnd) {
        // bufOffset 이 이 블록 텍스트 안에 있거나 이전 블록 개행에 있음
        const inBlockOffset = Math.max(0, Math.min(bufOffset - start, blockTextLens[k]!));
        return accBlockStart + inBlockOffset;
      }
      // 개행(end-1) 을 넘어서도 이 블록의 끝(= textEnd) 로 클램프
      if (bufOffset === end - 1 && bi < ranges.length - 1) {
        // 개행 위치 → 이 블록 끝
        return accBlockStart + blockTextLens[k]!;
      }
      accBlockStart += blockTextLens[k]!;
    }
    return accBlockStart; // 영향 범위 끝
  }

  // lo, hi 의 flat 위치 계산
  // lo 는 텍스트 글자 위치 (개행이면 이전 블록 끝)
  // hi 는 텍스트 글자 위치 또는 개행 다음 글자
  const flatLo = bufferToFlat(lo);
  const flatHi = bufferToFlat(hi);

  // 삽입 텍스트를 flat runs 로 변환 (개행은 블록 분리 마커 — flat 텍스트에는 포함하되 mask=0)
  const textSegs = text.split("\n");
  const insertRuns: MarkRun[] = textSegs
    .flatMap((seg) => (seg.length === 0 ? [] : [{ len: seg.length, mask }]))
    .filter((r) => r.len > 0);

  // flat run-list 에서 [flatLo, flatHi) 를 insertRuns 로 치환
  const newFlat = _replaceInFlatRuns(flatRuns, flatLo, flatHi, insertRuns);

  // 새 블록들의 세그먼트 길이로 flat 재분할
  const insertedBlockCount = text.split("\n").length - 1;
  const totalNewBlocks = 1 + insertedBlockCount;
  const segLens: number[] = [];
  for (let i = 0; i < totalNewBlocks; i++) {
    segLens.push(newBlocks[startBlockIdx + i]?.length ?? 0);
  }

  const splitRuns = _splitFlatRunsByBlockLens(newFlat, segLens);

  return [...prefix, ...splitRuns, ...suffix];
}

/**
 * flat run-list 에서 [lo, hi) 를 replacements 로 치환.
 */
function _replaceInFlatRuns(
  runs: MarkRun[],
  lo: number,
  hi: number,
  replacements: MarkRun[],
): MarkRun[] {
  const before: MarkRun[] = [];
  const after: MarkRun[] = [];
  let pos = 0;

  for (const run of runs) {
    const runEnd = pos + run.len;

    if (runEnd <= lo) {
      before.push({ ...run });
    } else if (pos >= hi) {
      after.push({ ...run });
    } else {
      // 겹침
      if (pos < lo) {
        before.push({ len: lo - pos, mask: run.mask });
      }
      if (runEnd > hi) {
        after.push({ len: runEnd - hi, mask: run.mask });
      }
    }
    pos = runEnd;
  }

  return normalizeRuns([...before, ...replacements, ...after]);
}

/**
 * flat run-list 를 블록 길이 배열에 따라 분할.
 */
function _splitFlatRunsByBlockLens(flat: MarkRun[], segLens: number[]): MarkRun[][] {
  const result: MarkRun[][] = [];
  let remaining = [...flat];

  for (const segLen of segLens) {
    if (segLen === 0) {
      result.push([]);
      continue;
    }
    const blockRuns_: MarkRun[] = [];
    let needed = segLen;
    while (needed > 0 && remaining.length > 0) {
      const head = remaining[0];
      if (head.len <= needed) {
        blockRuns_.push({ ...head });
        needed -= head.len;
        remaining = remaining.slice(1);
      } else {
        blockRuns_.push({ len: needed, mask: head.mask });
        remaining[0] = { len: head.len - needed, mask: head.mask };
        needed = 0;
      }
    }
    result.push(normalizeRuns(blockRuns_));
  }

  return result;
}

// ─────────────────────────────────────────
// deleteRange (T009)
// ─────────────────────────────────────────

/**
 * [lo, hi) 범위를 제거. 새 DocModel 반환.
 * lo === hi 이면 무변경.
 */
export function deleteRange(model: DocModel, lo: number, hi: number): DocModel {
  if (lo === hi) return model;
  return insertText(model, lo, hi, "", 0);
}

// ─────────────────────────────────────────
// splitBlock (T011)
// ─────────────────────────────────────────

/**
 * caret 위치에 '\n' 삽입.
 * - listItem 블록에서 분할 시 새 블록도 같은 listKind·depth listItem.
 * - 빈 listItem 에서 분할 시 해당 블록을 paragraph로 강등 (목록 종료 동작).
 * - 그 외 새 블록은 { type: 'paragraph' }. 앞 블록의 attr 는 보존.
 * markRuns 추종.
 */
export function splitBlock(model: DocModel, caret: number): DocModel {
  const bi = blockIndexAt(model, caret);
  const attr = model.blockAttrs[bi];

  // 빈 listItem 에서 분할 → paragraph 강등
  if (attr && attr.type === "listItem") {
    const parts = model.buffer.split("\n");
    const blockText = parts[bi] ?? "";
    if (blockText.length === 0) {
      // 빈 listItem → paragraph로 강등, 블록 분할 없음
      const newAttrs = [
        ...model.blockAttrs.slice(0, bi),
        { type: "paragraph" as const },
        ...model.blockAttrs.slice(bi + 1),
      ];
      return { buffer: model.buffer, blockAttrs: newAttrs, markRuns: model.markRuns };
    }

    // 비어있지 않은 listItem → 새 블록도 같은 listKind·depth
    const after = insertText(model, caret, caret, "\n", 0);
    // insertText가 새 블록을 paragraph로 만들었으니 listItem으로 교체
    const newAttrs = after.blockAttrs.map((a, i) => {
      if (i === bi + 1) {
        return { type: "listItem" as const, listKind: attr.listKind, depth: attr.depth };
      }
      return a;
    });
    return { ...after, blockAttrs: newAttrs };
  }

  return insertText(model, caret, caret, "\n", 0);
}

// ─────────────────────────────────────────
// mergeWithPrev (T011)
// ─────────────────────────────────────────

/**
 * blockIdx 와 이전 블록을 병합 (이전 '\n' 제거).
 * - 이전 블록 attr 유지, 현재 블록 attr 제거.
 * - blockIdx === 0 이면 무변경.
 * markRuns: 두 블록 run-list 이어붙임 후 정규화.
 */
export function mergeWithPrev(model: DocModel, blockIdx: number): DocModel {
  if (blockIdx === 0) return model;

  const { buffer, blockAttrs, markRuns } = model;
  const ranges = blockRanges(buffer);
  const prevRange = ranges[blockIdx - 1];
  const newlinePos = prevRange.end - 1; // '\n' 위치

  // '\n' 제거
  const newBuffer = buffer.slice(0, newlinePos) + buffer.slice(newlinePos + 1);

  // blockAttrs: 이전 attr 유지, 현재 attr 제거
  const newAttrs = [
    ...blockAttrs.slice(0, blockIdx - 1),
    blockAttrs[blockIdx - 1],
    ...blockAttrs.slice(blockIdx + 1),
  ];

  // markRuns: 이전 블록 + 현재 블록 run-list 이어붙임 후 정규화
  const prevRuns = normalizeRuns(markRuns[blockIdx - 1] ?? []);
  const currRuns = normalizeRuns(markRuns[blockIdx] ?? []);
  const mergedRuns = normalizeRuns([...prevRuns, ...currRuns]);

  const newMarkRuns = [
    ...markRuns.slice(0, blockIdx - 1),
    mergedRuns,
    ...markRuns.slice(blockIdx + 1),
  ];

  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs, markRuns: newMarkRuns });
}

// ─────────────────────────────────────────
// mergeWithNext (T011)
// ─────────────────────────────────────────

/**
 * blockIdx 와 다음 블록을 병합.
 * - 현재 블록 attr 유지, 다음 블록 attr 제거.
 * - 마지막 블록이면 무변경.
 */
export function mergeWithNext(model: DocModel, blockIdx: number): DocModel {
  const ranges = blockRanges(model.buffer);
  if (blockIdx >= ranges.length - 1) return model;

  // mergeWithPrev(blockIdx+1) 은 이전(=현재) attr 을 유지하므로 직접 사용
  return mergeWithPrev(model, blockIdx + 1);
}

// ─────────────────────────────────────────
// toggleHeading (T011)
// ─────────────────────────────────────────

/**
 * blockIdx 블록의 attr 를 heading(level) 으로 토글한다(순수, buffer/markRuns 불변).
 */
export function toggleHeading(model: DocModel, blockIdx: number, level: 1 | 2 | 3): DocModel {
  const { buffer, blockAttrs, markRuns } = model;
  if (blockIdx < 0 || blockIdx >= blockAttrs.length) return model;

  const current = blockAttrs[blockIdx];
  const isSameLevel = current.type === "heading" && current.level === level;
  const newAttr: BlockAttr = isSameLevel ? { type: "paragraph" } : { type: "heading", level };

  const newAttrs = [
    ...blockAttrs.slice(0, blockIdx),
    newAttr,
    ...blockAttrs.slice(blockIdx + 1),
  ];

  return { buffer, blockAttrs: newAttrs, markRuns };
}

// ─────────────────────────────────────────
// insertHr (T006/T007)
// ─────────────────────────────────────────

/**
 * offset 위치에 hr 블록 삽입. offset에서 현재 블록을 앞/뒤로 분리하고
 * 사이에 빈 hr 블록을 끼워넣는다. INV-6 보장.
 *
 * 결과 블록 순서: [앞 블록들] [앞 텍스트 블록] [hr 블록] [뒤 텍스트 블록] [뒤 블록들]
 * offset=블록 시작이면 앞 텍스트 블록이 비어 hr이 먼저 보임.
 * offset=블록 끝이면 뒤 텍스트 블록이 비어 hr이 마지막.
 */
export function insertHr(model: DocModel, offset: number): DocModel {
  const bi = blockIndexAt(model, offset);
  const ranges = blockRanges(model.buffer);
  const range = ranges[bi];

  // 블록 내 텍스트 끝 (개행 제외)
  const textEnd = bi < ranges.length - 1 ? range.end - 1 : range.end;
  const clampedOffset = Math.min(Math.max(offset, range.start), textEnd);
  const localOffset = clampedOffset - range.start;

  // 현재 블록의 run-list를 앞/뒤로 분리
  const prevRuns = blockRuns(model, bi);
  let pos = 0;
  const frontRuns: MarkRun[] = [];
  const backRuns: MarkRun[] = [];
  for (const run of prevRuns) {
    const runEnd = pos + run.len;
    if (runEnd <= localOffset) {
      frontRuns.push({ ...run });
    } else if (pos >= localOffset) {
      backRuns.push({ ...run });
    } else {
      frontRuns.push({ len: localOffset - pos, mask: run.mask });
      backRuns.push({ len: runEnd - localOffset, mask: run.mask });
    }
    pos = runEnd;
  }

  // buffer: 앞 텍스트 + \n + "" + \n + 뒤 텍스트
  const before = model.buffer.slice(0, clampedOffset);
  const after = model.buffer.slice(clampedOffset);
  const newBuffer = before + "\n\n" + after;

  // attrs: [앞 블록들] [앞 블록(현재 attr)] [hr] [뒤 블록(paragraph)] [뒤 블록들]
  const newAttrs: BlockAttr[] = [
    ...model.blockAttrs.slice(0, bi),
    model.blockAttrs[bi]!,   // 앞 분리 블록 — 현재 attr 유지
    { type: "hr" },
    { type: "paragraph" },   // 뒤 분리 블록
    ...model.blockAttrs.slice(bi + 1),
  ];

  const newMarkRuns: MarkRun[][] = [
    ...model.markRuns.slice(0, bi),
    normalizeRuns(frontRuns), // 앞 블록 runs
    [],                        // hr 블록 (INV-6)
    normalizeRuns(backRuns),  // 뒤 블록 runs
    ...model.markRuns.slice(bi + 1),
  ];

  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs, markRuns: newMarkRuns });
}

// ─────────────────────────────────────────
// deleteAtomicAt (T006/T007)
// ─────────────────────────────────────────

/**
 * blockIndex 위치의 hr 블록을 제거. hr이 아니면 무변경.
 * hr 블록의 \n 경계 하나만 제거하여 앞/뒤 블록이 독립 유지되도록 한다.
 * - blockIndex > 0: 앞 블록의 \n(=range.start-1) + hr 빈 세그먼트(없음) 제거.
 *   즉 [range.start-1, range.end-1) 범위를 제거(hr의 \n 제외, 앞 \n만 제거).
 * - blockIndex === 0: 뒤 \n(=range.end-1)만 제거.
 * INV-1/4/5/6 유지.
 */
export function deleteAtomicAt(model: DocModel, blockIndex: number): DocModel {
  const attr = model.blockAttrs[blockIndex];
  if (!attr || !isAtomic(attr)) return model;

  const ranges = blockRanges(model.buffer);
  const range = ranges[blockIndex];

  let delStart: number;
  let delEnd: number;

  if (blockIndex === 0) {
    // 첫 블록: 뒤 \n(range.end-1) 제거 → [range.start, range.end)
    // hr 빈 세그먼트("") + 뒤 \n 제거
    delStart = range.start;
    delEnd = range.end;
  } else {
    // 앞 블록의 \n(range.start-1) 제거 → hr 빈 세그먼트는 없으므로
    // 제거 범위: [range.start-1, range.end-1) — hr의 \n은 이전 블록 끝으로 유지됨
    // 단, hr이 중간 블록이면 [range.start-1, range.end-1) = [앞\n 위치, hr\n 위치)
    // hr이 마지막 블록이면 앞\n만 제거: [range.start-1, range.start)
    delStart = range.start - 1;
    delEnd = range.end - (blockIndex < ranges.length - 1 ? 1 : 0);
    // 마지막 블록이면 end=buffer.length(개행 없음), 제거 = [start-1, start)
    if (blockIndex === ranges.length - 1) {
      delEnd = range.start;
    }
  }

  return deleteRange(model, delStart, delEnd);
}

// ─────────────────────────────────────────
// nextCaretSkippingAtomic (T006/T007)
// ─────────────────────────────────────────

/**
 * dir 방향으로 한 칸 이동한 캐럿 위치를 반환. hr 블록은 건너뜀.
 * dir=+1: offset + 1 방향(오른쪽), dir=-1: offset - 1 방향(왼쪽).
 * 경계를 벗어나면 현재 offset 반환.
 */
export function nextCaretSkippingAtomic(model: DocModel, offset: number, dir: -1 | 1): number {
  const bufLen = model.buffer.length;
  let next = offset + dir;

  if (next < 0) return 0;
  if (next > bufLen) return bufLen;

  // next가 hr 블록 안인지 확인 (hr 세그먼트는 빈 문자열이므로 \n 위치가 hr 범위)
  const bi = blockIndexAt(model, next);
  const attr = model.blockAttrs[bi];

  if (attr && isAtomic(attr)) {
    // hr 블록을 건너뜀 → 그 방향의 끝으로
    const ranges = blockRanges(model.buffer);
    const hrRange = ranges[bi];
    if (dir === 1) {
      // hr 다음 블록 시작
      if (bi < ranges.length - 1) {
        return ranges[bi + 1]!.start;
      }
      return bufLen;
    } else {
      // hr 이전 블록 끝 (텍스트 끝, 개행 제외)
      if (bi > 0) {
        const prevRange = ranges[bi - 1]!;
        // 이전 블록 텍스트 끝 = prevRange.end - 1 (개행 제외), 마지막 블록이면 그냥 end
        return bi - 1 < ranges.length - 1 ? prevRange.end - 1 : prevRange.end;
      }
      return 0;
    }
  }

  return next;
}

// ─────────────────────────────────────────
// toggleBlockType (T004/T005)
// ─────────────────────────────────────────

/**
 * blockIndex 블록의 type을 전환. buffer/markRuns 불변.
 * listItem 전환 시 depth=0.
 */
export function toggleBlockType(
  model: DocModel,
  blockIndex: number,
  next: "paragraph" | "blockquote" | { listKind: "bullet" | "ordered" },
): DocModel {
  if (blockIndex < 0 || blockIndex >= model.blockAttrs.length) return model;

  let newAttr: BlockAttr;
  if (next === "paragraph") {
    newAttr = { type: "paragraph" };
  } else if (next === "blockquote") {
    newAttr = { type: "blockquote" };
  } else {
    newAttr = { type: "listItem", listKind: next.listKind, depth: 0 };
  }

  const newAttrs = [
    ...model.blockAttrs.slice(0, blockIndex),
    newAttr,
    ...model.blockAttrs.slice(blockIndex + 1),
  ];

  return { buffer: model.buffer, blockAttrs: newAttrs, markRuns: model.markRuns };
}

// ─────────────────────────────────────────
// listNumberAt (T008/T009)
// ─────────────────────────────────────────

/**
 * blockIndex 블록이 ordered listItem이면 1-based 파생 번호를 반환.
 * 위로 연속된 같은 (ordered, depth) 블록 수 + 1.
 * 중간에 다른 type/listKind/depth가 끼면 재시작.
 * ordered listItem이 아니면 null.
 */
export function listNumberAt(model: DocModel, blockIndex: number): number | null {
  const attr = model.blockAttrs[blockIndex];
  if (!attr || attr.type !== "listItem" || attr.listKind !== "ordered") return null;

  const depth = attr.depth;
  let count = 1;
  for (let i = blockIndex - 1; i >= 0; i--) {
    const a = model.blockAttrs[i];
    if (a && a.type === "listItem" && a.listKind === "ordered" && a.depth === depth) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─────────────────────────────────────────
// isAtomic (T003/T007)
// ─────────────────────────────────────────

/**
 * attr 가 원자 블록(편집 불가, 캐럿 진입 불가)이면 true.
 * 현재 hr 만 원자.
 */
export function isAtomic(attr: BlockAttr): boolean {
  return attr.type === "hr";
}

// ─────────────────────────────────────────
// insertSoftBreak (T016/T017)
// ─────────────────────────────────────────

/**
 * offset 위치에 SOFT_BREAK(U+2028) 삽입.
 * U+2028 은 블록 내 문자로 취급 — blockRanges('\n' 기준) 불변.
 * markRuns 정합: 삽입 위치 run len +1. INV-4 (U+2028 1글자 카운트) 보장.
 */
export function insertSoftBreak(model: DocModel, offset: number): DocModel {
  return insertText(model, offset, offset, SOFT_BREAK, 0);
}

// ─────────────────────────────────────────
// sliceModel (R3 - 복사용 부분 문서 추출)
// ─────────────────────────────────────────

/**
 * [lo, hi) 범위의 부분 문서를 새 DocModel 로 추출 (복사용).
 *
 * - 범위가 걸친 블록들: 각 블록에서 [lo,hi) 와 겹치는 텍스트 부분 + markRuns 부분만.
 * - 부분적으로 걸친 첫/끝 블록은 그 블록의 attr 유지.
 * - 결과 buffer = 범위 내 텍스트(블록 경계 '\n' 보존, 블록 내 U+2028 보존).
 * - lo >= hi 이면 빈 모델 반환 (INV-3).
 * - INV-1,4,5,6,7 만족.
 */
export function sliceModel(model: DocModel, lo: number, hi: number): DocModel {
  const EMPTY: DocModel = {
    buffer: "",
    blockAttrs: [{ type: "paragraph" }],
    markRuns: [[]],
  };
  if (lo >= hi) return EMPTY;

  const { buffer, blockAttrs, markRuns } = model;
  const parts = buffer.split("\n");

  // 각 블록의 [start, end) 계산 (end = 개행 포함)
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const segLen = parts[i]!.length;
    const end = i < parts.length - 1 ? pos + segLen + 1 : pos + segLen; // +1 for '\n'
    ranges.push({ start: pos, end });
    pos = end;
  }

  const clampedLo = Math.max(0, lo);
  const clampedHi = Math.min(buffer.length, hi);

  if (clampedLo >= clampedHi) return EMPTY;

  const newParts: string[] = [];
  const newAttrs: BlockAttr[] = [];
  const newRuns: MarkRun[][] = [];

  for (let bi = 0; bi < ranges.length; bi++) {
    const { start, end } = ranges[bi]!;
    // 블록 텍스트 영역: start ~ (end - (마지막 아닌 경우 1)) — 개행 제외
    const textStart = start;
    const textEnd = bi < ranges.length - 1 ? end - 1 : end;

    // [lo, hi) 와 겹치는 텍스트 범위
    const overlapLo = Math.max(clampedLo, textStart);
    const overlapHi = Math.min(clampedHi, textEnd);

    // 개행('\n')도 범위에 포함 여부: 이 블록의 '\n'이 lo~hi 안에 있는가
    const hasNewline = bi < ranges.length - 1 && clampedHi > textEnd;

    if (overlapLo > overlapHi) {
      // 이 블록의 텍스트는 전혀 겹치지 않음. 개행이 범위에 걸쳐있는지 확인.
      // 개행은 textEnd 위치(= end-1). clampedLo <= textEnd < clampedHi 이면 개행 포함.
      if (bi < ranges.length - 1 && clampedLo <= textEnd && textEnd < clampedHi) {
        // 빈 블록으로 포함 (개행만 걸쳐있음)
        newParts.push("");
        newAttrs.push(blockAttrs[bi] ?? { type: "paragraph" });
        newRuns.push([]);
      }
      continue;
    }

    // 이 블록의 텍스트 중 [overlapLo, overlapHi) 추출
    const segText = buffer.slice(overlapLo, overlapHi);
    newParts.push(segText);
    newAttrs.push(blockAttrs[bi] ?? { type: "paragraph" });

    // markRuns 의 해당 범위 추출
    const localLo = overlapLo - textStart;
    const localHi = overlapHi - textStart;
    const blockRunList = normalizeRuns(markRuns[bi] ?? []);
    const slicedRuns = _sliceRuns(blockRunList, localLo, localHi);
    newRuns.push(slicedRuns);

    // 이 블록 뒤에 '\n' 이 범위 내에 있으면 — 다음 반복에서 처리될 블록이 있어야 함
    // (개행은 텍스트 사이 구분자로 자동 복원)
  }

  if (newParts.length === 0) return EMPTY;

  const newBuffer = newParts.join("\n");
  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs, markRuns: newRuns });
}

/**
 * run-list 에서 [lo, hi) 범위만 추출 (슬라이스).
 */
function _sliceRuns(runs: MarkRun[], lo: number, hi: number): MarkRun[] {
  if (lo >= hi) return [];
  const result: MarkRun[] = [];
  let pos = 0;

  for (const run of runs) {
    const runEnd = pos + run.len;
    if (runEnd <= lo) { pos = runEnd; continue; }
    if (pos >= hi) break;

    const oLo = Math.max(pos, lo);
    const oHi = Math.min(runEnd, hi);
    if (oLo < oHi) {
      result.push({ len: oHi - oLo, mask: run.mask });
    }
    pos = runEnd;
  }

  return normalizeRuns(result);
}

// ─────────────────────────────────────────
// insertModel (R3 - 리치 붙여넣기)
// ─────────────────────────────────────────

/**
 * [lo, hi) 를 먼저 삭제한 뒤 lo 에 sub 를 삽입.
 *
 * sub 가 1블록: 인라인 삽입 → 삽입 지점의 블록 안에 텍스트를 끼워넣음.
 * sub 가 2블록 이상:
 *   firstNew = left.text + sub[0].text (attr=A, marks left++sub[0])
 *   middle   = sub[1..n-2] 블록 그대로
 *   lastNew  = sub[last].text + right.text (attr=sub[last].attr, marks sub[last]++right)
 * reconcileAttrs 로 마무리. INV 만족.
 */
export function insertModel(
  model: DocModel,
  lo: number,
  hi: number,
  sub: DocModel,
): DocModel {
  // 1. [lo, hi) 삭제
  const deleted = deleteRange(model, lo, hi);

  // 2. lo 가 속한 블록을 left / right 로 분리
  const { buffer, blockAttrs, markRuns } = deleted;
  const parts = buffer.split("\n");

  // lo 가 속한 블록 인덱스 계산 (deleteRange 후 lo 위치 재계산)
  // lo 는 deleteRange 에 의해 변경 안 됨 (삽입 지점 = 삭제 시작 = lo, clamp)
  const clampedLo = Math.max(0, Math.min(lo, buffer.length));

  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const segLen = parts[i]!.length;
    const end = i < parts.length - 1 ? pos + segLen + 1 : pos + segLen;
    ranges.push({ start: pos, end });
    pos = end;
  }

  // clampedLo 가 속한 블록 인덱스 (blockIndexAt 와 동일 로직)
  let bi = 0;
  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i]!;
    if (i === ranges.length - 1) {
      if (clampedLo >= start) { bi = i; break; }
    } else {
      if (clampedLo >= start && clampedLo < end) { bi = i; break; }
    }
  }

  const biRange = ranges[bi]!;
  const textStart = biRange.start;
  const textEnd = bi < ranges.length - 1 ? biRange.end - 1 : biRange.end;

  const localLo = clampedLo - textStart;
  const blockText = parts[bi] ?? "";
  const blockAttr = blockAttrs[bi] ?? { type: "paragraph" as const };
  const blockRunList = normalizeRuns(markRuns[bi] ?? []);

  // left = 블록 시작 ~ localLo
  const leftText = blockText.slice(0, localLo);
  const leftRuns = _sliceRuns(blockRunList, 0, localLo);
  // right = localLo ~ 블록 끝
  const rightText = blockText.slice(localLo);
  const rightRuns = _sliceRuns(blockRunList, localLo, blockText.length);

  // sub 블록 정보
  const subParts = sub.buffer.split("\n");
  const subCount = subParts.length;

  let newParts: string[];
  let newAttrs: BlockAttr[];
  let newRuns: MarkRun[][];

  const prefixParts = parts.slice(0, bi);
  const prefixAttrs = blockAttrs.slice(0, bi);
  const prefixRuns = markRuns.slice(0, bi);
  const suffixParts = parts.slice(bi + 1);
  const suffixAttrs = blockAttrs.slice(bi + 1);
  const suffixRuns = markRuns.slice(bi + 1);

  if (subCount === 1) {
    // 인라인 삽입
    const subText = subParts[0] ?? "";
    const subRunList = normalizeRuns(sub.markRuns[0] ?? []);
    const mergedText = leftText + subText + rightText;
    const mergedRuns = normalizeRuns([...leftRuns, ...subRunList, ...rightRuns]);

    newParts = [...prefixParts, mergedText, ...suffixParts];
    newAttrs = [...prefixAttrs, blockAttr, ...suffixAttrs];
    newRuns = [...prefixRuns, mergedRuns, ...suffixRuns];
  } else {
    // 2블록 이상
    // firstNew: left.text + sub[0].text, attr=A
    const firstText = leftText + (subParts[0] ?? "");
    const firstRunList = normalizeRuns([...leftRuns, ...normalizeRuns(sub.markRuns[0] ?? [])]);

    // lastNew: sub[last].text + right.text, attr=sub[last].attr
    const lastIdx = subCount - 1;
    const lastText = (subParts[lastIdx] ?? "") + rightText;
    const lastAttr = sub.blockAttrs[lastIdx] ?? { type: "paragraph" as const };
    const lastRunList = normalizeRuns([...normalizeRuns(sub.markRuns[lastIdx] ?? []), ...rightRuns]);

    // middle: sub[1..n-2]
    const middleParts = subParts.slice(1, lastIdx);
    const middleAttrs = sub.blockAttrs.slice(1, lastIdx);
    const middleRuns = sub.markRuns.slice(1, lastIdx);

    newParts = [...prefixParts, firstText, ...middleParts, lastText, ...suffixParts];
    newAttrs = [...prefixAttrs, blockAttr, ...middleAttrs, lastAttr, ...suffixAttrs];
    newRuns = [...prefixRuns, firstRunList, ...middleRuns, lastRunList, ...suffixRuns];
  }

  const newBuffer = newParts.join("\n");
  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs, markRuns: newRuns });
}

// reconcileAttrs 는 위에서 이미 export 됨 (공개 API)
