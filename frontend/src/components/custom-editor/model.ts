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

export type BlockAttr = { type: "paragraph" } | { type: "heading"; level: 1 | 2 | 3 };

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
 * caret 위치에 '\n' 삽입. 새 블록은 { type: 'paragraph' }.
 * 앞 블록의 attr 는 보존. markRuns 추종.
 */
export function splitBlock(model: DocModel, caret: number): DocModel {
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

// reconcileAttrs 는 위에서 이미 export 됨 (공개 API)
