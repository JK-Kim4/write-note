/**
 * POC 증명 — 안정적 블록 ID (공유/댓글 §6.2 앵커링).
 *
 * 두 축을 검증한다:
 *  (A) 충실성(faithfulness): POC 의 buffer/blockAttrs 재구성이 실제 model.ts 연산
 *      (insertText / mergeWithPrev) 출력과 정확히 일치 → POC 가 현실을 충실히 반영.
 *  (B) ID 안정성: 편집·영속 왕복을 거쳐도 앵커(blockId)가 안정적으로 보존되거나
 *      예측 가능하게 orphan 됨.
 */
import { describe, expect, it } from "vitest";
import { insertText, mergeWithPrev } from "@/components/custom-editor/model";
import {
  deleteRangeIds,
  fromText,
  idTextMap,
  insertTextIds,
  makeCounter,
  mergeWithPrevIds,
  resolveAnchor,
  splitBlockIds,
  toDocModel,
  type IdDocModel,
} from "./idModel";
import { modelToPmJsonIds, pmJsonToModelIds, type PmDoc } from "./idPmConvert";

const TEXT = "Alpha\nBravo\nCharlie\nDelta";
// 오프셋: Alpha 0-4 / '\n'5 / Bravo 6-10 / '\n'11 / Charlie 12-18 / '\n'19 / Delta 20-24

function sample(): { m: IdDocModel; ids: string[] } {
  const m = fromText(TEXT, makeCounter("c"));
  return { m, ids: [...m.blockIds] };
}

describe("불변식(INV) — 구성", () => {
  it("blockIds.length === 블록 수, 전부 unique", () => {
    const { m } = sample();
    expect(m.blockIds.length).toBe(m.buffer.split("\n").length);
    expect(new Set(m.blockIds).size).toBe(m.blockIds.length);
  });
});

describe("(A) 충실성 — POC 재구성이 실제 model.ts 와 일치", () => {
  const cases: ReadonlyArray<{ name: string; lo: number; hi: number; text: string }> = [
    { name: "블록 내부 타이핑", lo: 14, hi: 14, text: "X" },
    { name: "경계에서 Enter(분할)", lo: 11, hi: 11, text: "\n" },
    { name: "블록 중간 Enter(분할)", lo: 15, hi: 15, text: "\n" },
    { name: "선택 구간 치환", lo: 7, hi: 14, text: "ZZ" },
    { name: "구간 삭제(개행 포함)", lo: 5, hi: 11, text: "" },
  ];
  for (const c of cases) {
    it(`insertTextIds == insertText: ${c.name}`, () => {
      const { m } = sample();
      const poc = insertTextIds(m, c.lo, c.hi, c.text, makeCounter("n"));
      const real = insertText(toDocModel(m), c.lo, c.hi, c.text, 0);
      expect(poc.buffer).toBe(real.buffer);
      expect(poc.blockAttrs).toEqual(real.blockAttrs);
      // ID 수 = 블록 수 유지(reconcile no-op 임을 간접 확인)
      expect(poc.blockIds.length).toBe(poc.buffer.split("\n").length);
    });
  }

  it("mergeWithPrevIds == mergeWithPrev (buffer/attrs)", () => {
    const { m } = sample();
    const poc = mergeWithPrevIds(m, 2); // Charlie 를 Bravo 에 병합
    const real = mergeWithPrev(toDocModel(m), 2);
    expect(poc.buffer).toBe(real.buffer);
    expect(poc.blockAttrs).toEqual(real.blockAttrs);
  });
});

describe("(B) ID 안정성 — 편집해도 앵커 보존", () => {
  it("블록 내부 타이핑 → 모든 ID 불변", () => {
    const { m, ids } = sample();
    const after = insertTextIds(m, 14, 14, "X", makeCounter("n"));
    expect(after.blockIds).toEqual(ids); // 그대로
    expect(resolveAnchor(after, ids[2])).toBe("ChXarlie"); // 같은 블록, 본문만 변경
  });

  it("다른 곳에 새 문단 삽입 → 기존 블록 앵커 안 밀림", () => {
    const { m, ids } = sample();
    // Bravo 끝(경계)에서 Enter → Bravo·Charlie 사이 빈 문단 1개 추가
    const after = splitBlockIds(m, 11, makeCounter("n"));
    expect(after.blockIds.length).toBe(5); // 4 → 5
    // 기존 4개 앵커가 전부 원래 블록 텍스트로 그대로 resolve
    expect(resolveAnchor(after, ids[0])).toBe("Alpha");
    expect(resolveAnchor(after, ids[1])).toBe("Bravo");
    expect(resolveAnchor(after, ids[2])).toBe("Charlie");
    expect(resolveAnchor(after, ids[3])).toBe("Delta");
    // 정확히 1개의 새 ID 만 추가
    const fresh = after.blockIds.filter((id) => !ids.includes(id));
    expect(fresh.length).toBe(1);
  });

  it("맨 위에 문단 삽입 → 아래 블록 앵커 전부 보존", () => {
    const { m, ids } = sample();
    const after = splitBlockIds(m, 0, makeCounter("n")); // 최상단 분할
    // 아래 블록(Bravo/Charlie/Delta) 앵커는 흔들리지 않음
    expect(resolveAnchor(after, ids[1])).toBe("Bravo");
    expect(resolveAnchor(after, ids[2])).toBe("Charlie");
    expect(resolveAnchor(after, ids[3])).toBe("Delta");
  });

  it("블록 중간 분할 → 윗부분이 ID 유지(아랫부분 fresh)", () => {
    const { m, ids } = sample();
    const after = splitBlockIds(m, 15, makeCounter("n")); // "Cha|rlie"
    expect(resolveAnchor(after, ids[2])).toBe("Cha"); // 윗부분 유지
    // 다른 블록 안정
    expect(resolveAnchor(after, ids[0])).toBe("Alpha");
    expect(resolveAnchor(after, ids[1])).toBe("Bravo");
    expect(resolveAnchor(after, ids[3])).toBe("Delta");
    // 아랫부분("rlie")은 fresh ID
    const map = idTextMap(after);
    const rlieId = [...map.entries()].find(([, t]) => t === "rlie")?.[0];
    expect(rlieId).toBeDefined();
    expect(ids.includes(rlieId as string)).toBe(false);
  });

  it("병합 → 앞 블록 ID 생존, 흡수된 블록 ID orphan", () => {
    const { m, ids } = sample();
    const after = mergeWithPrevIds(m, 2); // Charlie → Bravo
    expect(resolveAnchor(after, ids[1])).toBe("BravoCharlie"); // Bravo ID 생존
    expect(resolveAnchor(after, ids[2])).toBeNull(); // Charlie ID = orphan
    expect(resolveAnchor(after, ids[0])).toBe("Alpha");
    expect(resolveAnchor(after, ids[3])).toBe("Delta");
  });

  it("블록 삭제(선행 개행과 함께) → 삭제된 블록 ID 만 orphan", () => {
    const { m, ids } = sample();
    // "\nBravo" 삭제([5,11)) → Bravo 블록 제거
    const after = deleteRangeIds(m, 5, 11);
    expect(after.buffer).toBe("Alpha\nCharlie\nDelta");
    expect(resolveAnchor(after, ids[1])).toBeNull(); // Bravo orphan
    expect(resolveAnchor(after, ids[0])).toBe("Alpha");
    expect(resolveAnchor(after, ids[2])).toBe("Charlie");
    expect(resolveAnchor(after, ids[3])).toBe("Delta");
  });

  it("[알려진 뉘앙스] 블록 삭제(후행 개행과 함께) → orphan 대상이 경계 정렬에 의존", () => {
    const { m, ids } = sample();
    // "Bravo\n" 삭제([6,12)) → 실제 에디터 attr 재배치와 동일하게 Bravo ID 가 다음 블록으로 re-home
    const after = deleteRangeIds(m, 6, 12);
    expect(after.buffer).toBe("Alpha\nCharlie\nDelta");
    // Charlie 의 원래 ID 가 orphan 되고, Bravo ID 가 "Charlie" 텍스트로 옮겨감
    expect(resolveAnchor(after, ids[2])).toBeNull();
    expect(resolveAnchor(after, ids[1])).toBe("Charlie");
    // → 견고한 orphan 판정에는 content fingerprint 백스톱이 필요(PRD 반영).
  });

  it("현실적 편집 시퀀스 → 손대지 않은 블록 앵커 전부 생존", () => {
    const { m, ids } = sample();
    const mk = makeCounter("n");
    let s = insertTextIds(m, 5, 5, "!", mk); // Alpha 끝에 "!" (Alpha 내부)
    s = splitBlockIds(s, 12, mk); // Bravo 끝에서 Enter (Bravo 다음 빈 문단)
    s = insertTextIds(s, 13, 13, "new", mk); // 빈 문단에 타이핑
    // Charlie·Delta 는 손대지 않음 → 정확히 보존
    expect(resolveAnchor(s, ids[2])).toBe("Charlie");
    expect(resolveAnchor(s, ids[3])).toBe("Delta");
    // Alpha 는 본문이 바뀌었지만 같은 ID 유지(블록 단위 앵커)
    expect(resolveAnchor(s, ids[0])).toBe("Alpha!");
  });
});

describe("(B) ID 영속 — PM JSON 왕복 + 레거시 backfill", () => {
  it("ID 보유 모델 → PM → 모델 왕복 idempotent", () => {
    const m = fromText("Title\nBody one\nBody two", makeCounter("c"));
    const pm = modelToPmJsonIds(m);
    // 각 블록 노드에 bid 가 실림
    expect(pm.content.every((n) => typeof n.attrs?.bid === "string")).toBe(true);
    const back = pmJsonToModelIds(pm, makeCounter("should-not-mint"));
    expect(back.buffer).toBe(m.buffer);
    expect(back.blockIds).toEqual(m.blockIds); // 그대로 보존(거짓 dirty 방지)
    // 한 번 더 왕복해도 동일
    const back2 = pmJsonToModelIds(modelToPmJsonIds(back), makeCounter("x"));
    expect(back2.blockIds).toEqual(m.blockIds);
  });

  it("레거시 문서(bid 없음) → 로드 시 1회 backfill, 이후 안정", () => {
    const legacy: PmDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Old" }] },
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Head" }] },
      ],
    };
    const m = pmJsonToModelIds(legacy, makeCounter("bf"));
    expect(m.buffer).toBe("Old\nHead");
    expect(m.blockAttrs).toEqual([{ type: "paragraph" }, { type: "heading", level: 1 }]);
    expect(m.blockIds).toEqual(["bf-0", "bf-1"]); // backfill
    // 재저장(bid 박힘) 후 재로드 → 새 mint 없이 안정
    const reloaded = pmJsonToModelIds(modelToPmJsonIds(m), makeCounter("never"));
    expect(reloaded.blockIds).toEqual(["bf-0", "bf-1"]);
  });
});
