/**
 * POC — 안정적 블록 ID 주입 (공유/댓글 기능 PRD §6.2 앵커링 검증)
 *
 * 목적: 자체 에디터 DocModel(블록을 buffer 의 '\n' 경계 + 배열 인덱스로만 식별)에
 * 블록별 "안정적 ID" 를 병렬 배열로 부여하고, 편집(insertText/split/merge/delete)과
 * 영속 왕복을 거쳐도 ID 가 안정적으로 유지되는지 — 즉 위치 지정 댓글의 앵커가
 * 본문 위치 이동에 흔들리지 않는지 — 를 증명한다.
 *
 * 핵심 설계: 실제 model.ts `insertText` 의 attr 재구성
 *   newAttrs = [...prefix, startAttr, ...inserted(fresh), ...suffix]
 * 을 blockIds 에 그대로 미러링한다 →
 *   newBlockIds = [...prefix, startId(유지), ...inserted(fresh), ...suffix]
 * 따라서 "편집 시작 블록을 제외한 모든 prefix·suffix 블록 ID 가 무조건 보존" 된다
 * (= 위/아래에 문단을 삽입·삭제해도 다른 블록의 앵커가 밀리지 않음).
 *
 * POC 한정: markRuns(부분 스타일)는 생략한다 — attr 배열과 동형(同形)이라 ID 안정성
 * 증명에 불필요하다. 실제 통합 시 blockIds 를 blockAttrs/markRuns 와 "같은 splice 지점"에
 * 끼우면 된다. 본 모듈은 그 splice 골격의 충실성을 실제 model 연산과 cross-check 한다.
 */
import { blockIndexAt, type BlockAttr, type DocModel } from "@/components/custom-editor/model";

export type IdDocModel = {
  buffer: string;
  blockAttrs: BlockAttr[];
  /** 블록별 안정 식별자. INV: length === 블록 수, 전부 unique. */
  blockIds: string[];
};

export type IdGen = () => string;

/** 결정적 테스트용 카운터 생성기. 프로덕션은 `crypto.randomUUID()` 또는 nanoid. */
export function makeCounter(prefix = "id"): IdGen {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

/** 발급기를 호출하면 안 되는 경로(삽입 블록 0개)에 쓰는 가드 — 호출되면 버그. */
const NO_MINT: IdGen = () => {
  throw new Error("invariant: this operation must not mint ids");
};

export function blockCountOf(buffer: string): number {
  return buffer.split("\n").length;
}

/** 레거시 문서(ID 없음) → 블록 수만큼 ID 발급(backfill). */
export function mintIds(count: number, mkId: IdGen): string[] {
  return Array.from({ length: count }, () => mkId());
}

/** 평문 텍스트('\n' 구분 문단들) → IdDocModel. 전 블록 paragraph. */
export function fromText(text: string, mkId: IdGen): IdDocModel {
  const segs = text.split("\n");
  return {
    buffer: text,
    blockAttrs: segs.map(() => ({ type: "paragraph" }) as BlockAttr),
    blockIds: mintIds(segs.length, mkId),
  };
}

/**
 * IdDocModel → 실제 DocModel(mask 0 run 으로 markRuns 충족) 변환.
 * 실제 model.ts 연산(insertText/mergeWithPrev)과 출력을 cross-check 하기 위함.
 */
export function toDocModel(model: IdDocModel): DocModel {
  const segs = model.buffer.split("\n");
  const markRuns = segs.map((seg) => (seg.length > 0 ? [{ len: seg.length, mask: 0 }] : []));
  return { buffer: model.buffer, blockAttrs: model.blockAttrs, markRuns };
}

/** id↔text 매핑 — 댓글 앵커가 가리키는 블록 텍스트를 추적하는 테스트 보조. */
export function idTextMap(model: IdDocModel): Map<string, string> {
  const segs = model.buffer.split("\n");
  return new Map(model.blockIds.map((id, i) => [id, segs[i] ?? ""]));
}

/** 앵커(blockId)가 현재 모델에서 가리키는 블록 텍스트. 없으면 null(= orphan). */
export function resolveAnchor(model: IdDocModel, blockId: string): string | null {
  const idx = model.blockIds.indexOf(blockId);
  if (idx < 0) return null;
  return model.buffer.split("\n")[idx] ?? null;
}

/**
 * [lo, hi) 를 text 로 치환. 실제 model.ts insertText 의 buffer/attr 재구성을 미러링하며
 * blockIds 를 동일 골격으로 재구성한다(시작 블록 ID 유지, 삽입분 fresh, prefix/suffix 보존).
 */
export function insertTextIds(model: IdDocModel, lo: number, hi: number, text: string, mkId: IdGen): IdDocModel {
  const startBlockIdx = blockIndexAt(toDocModel(model), lo);

  const newBuffer = model.buffer.slice(0, lo) + text + model.buffer.slice(hi);
  const removedBlockCount = model.buffer.slice(lo, hi).split("\n").length - 1;
  const insertedBlockCount = text.split("\n").length - 1;

  // attr 재구성 — 실제 insertText(model.ts:442-453) 와 동일
  const startAttr = model.blockAttrs[startBlockIdx];
  const prefixAttrs = model.blockAttrs.slice(0, startBlockIdx);
  const suffixAttrs = model.blockAttrs.slice(startBlockIdx + 1 + removedBlockCount);
  const insertedAttrs: BlockAttr[] = Array.from({ length: insertedBlockCount }, () => ({ type: "paragraph" }));
  const newAttrs: BlockAttr[] = [...prefixAttrs, startAttr, ...insertedAttrs, ...suffixAttrs];

  // ID 재구성 — attr 와 정확히 같은 골격
  const prefixIds = model.blockIds.slice(0, startBlockIdx);
  const startId = model.blockIds[startBlockIdx];
  const suffixIds = model.blockIds.slice(startBlockIdx + 1 + removedBlockCount);
  const insertedIds = mintIds(insertedBlockCount, mkId);
  const newIds: string[] = [...prefixIds, startId, ...insertedIds, ...suffixIds];

  return { buffer: newBuffer, blockAttrs: newAttrs, blockIds: newIds };
}

/** 캐럿에서 블록 분할(Enter). 윗부분이 ID 유지, 아랫부분이 fresh. */
export function splitBlockIds(model: IdDocModel, caret: number, mkId: IdGen): IdDocModel {
  return insertTextIds(model, caret, caret, "\n", mkId);
}

/** [lo, hi) 삭제. 블록을 새로 만들지 않으므로 ID 발급 없음. */
export function deleteRangeIds(model: IdDocModel, lo: number, hi: number): IdDocModel {
  return insertTextIds(model, lo, hi, "", NO_MINT);
}

/** 블록 시작 오프셋(buffer 기준). */
function blockStartOffset(buffer: string, idx: number): number {
  const parts = buffer.split("\n");
  let off = 0;
  for (let i = 0; i < idx; i++) off += parts[i].length + 1; // 텍스트 + '\n'
  return off;
}

/**
 * blockIdx 를 이전 블록과 병합(Backspace). 경계 '\n' 을 삭제하는 것과 동치이며,
 * 실제 mergeWithPrev 의미론(이전 블록 ID 생존, 현재 블록 ID 소멸 → orphan)과 일치한다.
 */
export function mergeWithPrevIds(model: IdDocModel, blockIdx: number): IdDocModel {
  if (blockIdx <= 0) return model;
  const start = blockStartOffset(model.buffer, blockIdx);
  return deleteRangeIds(model, start - 1, start); // 직전 '\n' 제거
}
