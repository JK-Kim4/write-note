/**
 * 자체 에디터 내부 문서 모델 (순수 함수, 불변)
 *
 * 불변식:
 *   INV-1: blockAttrs.length === buffer.split('\n').length
 *   INV-2: heading 이면 level ∈ {1, 2, 3}
 *   INV-3: 빈 모델 = { buffer: '', blockAttrs: [{ type: 'paragraph' }] }
 *
 * 경계 규약 (blockIndexAt):
 *   개행 문자('\n') 자체는 이전 블록의 끝으로 귀속.
 *   즉, 오프셋 k 가 '\n' 이면 그 블록 인덱스 = '\n' 앞 블록.
 */

export type BlockAttr = { type: "paragraph" } | { type: "heading"; level: 1 | 2 | 3 };

export type DocModel = {
  buffer: string;
  blockAttrs: BlockAttr[];
};

export type Selection = { anchor: number; focus: number };

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
// insertText
// ─────────────────────────────────────────

/**
 * [lo, hi) 선택을 text 로 치환. 새 DocModel 반환.
 *
 * - text 에 '\n' 포함 시 블록이 증가하며, 증가분은 모두 { type: 'paragraph' }.
 * - 시작 블록(lo 가 속한 블록)의 attr 는 보존.
 */
export function insertText(model: DocModel, lo: number, hi: number, text: string): DocModel {
  const { buffer, blockAttrs } = model;

  // 치환 전 블록 수
  const prevBlocks = buffer.split("\n");

  // lo 가 속한 블록 인덱스 → attr 보존 대상
  const startBlockIdx = blockIndexAt(model, lo);
  const startAttr = blockAttrs[startBlockIdx];

  // 새 buffer 생성
  const newBuffer = buffer.slice(0, lo) + text + buffer.slice(hi);
  const newBlocks = newBuffer.split("\n");
  const newBlockCount = newBlocks.length;
  const prevBlockCount = prevBlocks.length;

  // 새 blockAttrs 구성
  // lo 기준 시작 블록 attr 보존, hi 기준 끝 블록 attr 이어붙이기
  // 제거된 범위의 블록 수 계산
  const removedBlockCount =
    buffer.slice(lo, hi).split("\n").length - 1; // 제거된 '\n' 수

  // 삽입된 '\n' 수
  const insertedBlockCount = text.split("\n").length - 1;

  // 블록 변화 = insertedBlockCount - removedBlockCount
  // 즉, newBlockCount = prevBlockCount + insertedBlockCount - removedBlockCount

  // 기존 attrs 에서:
  //   0 .. startBlockIdx-1: 앞 블록들 (변경 없음)
  //   startBlockIdx: 시작 블록 attr 보존
  //   startBlockIdx+1 .. startBlockIdx+removedBlockCount: 제거된 블록 attr
  //   startBlockIdx+removedBlockCount+1 .. end: 뒤 블록들 (변경 없음)
  const prefixAttrs = blockAttrs.slice(0, startBlockIdx);
  const suffixAttrs = blockAttrs.slice(startBlockIdx + 1 + removedBlockCount);

  // 삽입된 새 블록들 (startBlockIdx 제외, insertedBlockCount 개)
  const insertedAttrs: BlockAttr[] = Array.from({ length: insertedBlockCount }, () => ({
    type: "paragraph" as const,
  }));

  const newAttrs: BlockAttr[] = [
    ...prefixAttrs,
    startAttr, // 시작 블록 attr 보존
    ...insertedAttrs,
    ...suffixAttrs,
  ];

  // 길이 정합 보장 (reconcile fallback)
  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs });
}

// ─────────────────────────────────────────
// deleteRange
// ─────────────────────────────────────────

/**
 * [lo, hi) 범위를 제거. 새 DocModel 반환.
 *
 * - 개행 제거로 블록이 병합되면 시작 블록(lo 가 속한 블록) attr 유지.
 * - lo === hi 이면 무변경.
 */
export function deleteRange(model: DocModel, lo: number, hi: number): DocModel {
  if (lo === hi) return model;
  return insertText(model, lo, hi, "");
}

// ─────────────────────────────────────────
// splitBlock
// ─────────────────────────────────────────

/**
 * caret 위치에 '\n' 삽입. 새 블록은 { type: 'paragraph' }.
 * 앞 블록의 attr 는 보존.
 */
export function splitBlock(model: DocModel, caret: number): DocModel {
  return insertText(model, caret, caret, "\n");
}

// ─────────────────────────────────────────
// mergeWithPrev
// ─────────────────────────────────────────

/**
 * blockIdx 와 이전 블록을 병합 (이전 '\n' 제거).
 * - 이전 블록 attr 유지, 현재 블록 attr 제거.
 * - blockIdx === 0 이면 무변경.
 */
export function mergeWithPrev(model: DocModel, blockIdx: number): DocModel {
  if (blockIdx === 0) return model;

  const { buffer, blockAttrs } = model;
  const ranges = blockRanges(buffer);
  const prevRange = ranges[blockIdx - 1];
  const currRange = ranges[blockIdx];

  // 이전 블록의 마지막 문자 = '\n' (end-1 위치)
  const newlinePos = prevRange.end - 1;

  // '\n' 제거
  const newBuffer = buffer.slice(0, newlinePos) + buffer.slice(newlinePos + 1);

  // blockAttrs: 이전 attr 유지, 현재 attr 제거
  const newAttrs = [
    ...blockAttrs.slice(0, blockIdx - 1),
    blockAttrs[blockIdx - 1], // 이전 블록 attr 유지
    ...blockAttrs.slice(blockIdx + 1),
  ];

  return reconcileAttrs({ buffer: newBuffer, blockAttrs: newAttrs });
}

// ─────────────────────────────────────────
// mergeWithNext
// ─────────────────────────────────────────

/**
 * blockIdx 와 다음 블록을 병합.
 * - 현재 블록 attr 유지, 다음 블록 attr 제거.
 * - 마지막 블록이면 무변경.
 */
export function mergeWithNext(model: DocModel, blockIdx: number): DocModel {
  const ranges = blockRanges(model.buffer);
  if (blockIdx >= ranges.length - 1) return model;

  return mergeWithPrev(
    // 다음 블록을 이전 블록(=현재)과 병합하면 현재 attr 유지
    // mergeWithPrev(blockIdx+1) 은 이전(=현재) attr 을 유지하므로 직접 사용
    model,
    blockIdx + 1,
  );
}

// ─────────────────────────────────────────
// reconcileAttrs
// ─────────────────────────────────────────

/**
 * blockAttrs 길이를 buffer 블록 수에 맞춤.
 * - 부족분: { type: 'paragraph' } 추가
 * - 초과분: 절단
 *
 * INV-1 fallback 보정 함수.
 */
export function reconcileAttrs(model: DocModel): DocModel {
  const blockCount = model.buffer.split("\n").length;
  const { blockAttrs } = model;

  if (blockAttrs.length === blockCount) return model;

  if (blockAttrs.length < blockCount) {
    const toAdd = blockCount - blockAttrs.length;
    const padded: BlockAttr[] = Array.from({ length: toAdd }, () => ({
      type: "paragraph" as const,
    }));
    return { buffer: model.buffer, blockAttrs: [...blockAttrs, ...padded] };
  }

  // 초과: 절단
  return { buffer: model.buffer, blockAttrs: blockAttrs.slice(0, blockCount) };
}
