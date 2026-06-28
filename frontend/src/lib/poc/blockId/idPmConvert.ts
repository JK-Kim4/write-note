/**
 * POC — 블록 ID 의 영속 왕복(PM JSON) + 레거시 backfill.
 *
 * 본문은 디스크에 ProseMirror/PM JSON(documents.body, jsonb)으로 저장된다. 블록 ID 를
 * 각 블록 노드의 `attrs.bid` 로 실어 왕복한다 → DB 스키마 변경 0(기존 jsonb 안에 들어감).
 *
 * - 기존 문서(bid 없음)는 로드 시 1회 mint(backfill) → 다음 저장에서 bid 가 박혀 영속.
 * - 왕복 idempotence: ID 보유 모델 → PM → 모델' 에서 ID 가 그대로 보존(거짓 dirty 방지,
 *   code-quality "직렬화 왕복 idempotence" 룰과 정합).
 *
 * POC 한정: paragraph + heading 만 다룬다(공통 케이스). 실제 통합 시 blockquote/listItem/hr
 * 노드에도 동일하게 `attrs.bid` 를 부여한다(pmConvert.ts flatten/serialize 전 지점).
 */
import type { BlockAttr } from "@/components/custom-editor/model";
import { mintIds, type IdDocModel, type IdGen } from "./idModel";

export type PmTextNode = { type: "text"; text: string };
export type PmBlockNode = {
  type: "paragraph" | "heading";
  attrs?: { level?: 1 | 2 | 3; bid?: string };
  content?: PmTextNode[];
};
export type PmDoc = { type: "doc"; content: PmBlockNode[] };

/** IdDocModel → PM JSON. 각 블록 노드 attrs.bid 에 블록 ID 를 싣는다. */
export function modelToPmJsonIds(model: IdDocModel): PmDoc {
  const segs = model.buffer.split("\n");
  return {
    type: "doc",
    content: segs.map((seg, i) => {
      const attr: BlockAttr = model.blockAttrs[i] ?? { type: "paragraph" };
      const bid = model.blockIds[i];
      const content = seg.length > 0 ? [{ type: "text" as const, text: seg }] : undefined;
      if (attr.type === "heading") {
        return { type: "heading", attrs: { level: attr.level, bid }, content };
      }
      return { type: "paragraph", attrs: { bid }, content };
    }),
  };
}

/**
 * PM JSON → IdDocModel. `attrs.bid` 가 있으면 그대로 채택, 없으면 mint(backfill).
 * heading/paragraph 외 노드는 POC 범위 밖이라 paragraph 로 환원.
 */
export function pmJsonToModelIds(doc: PmDoc, mkId: IdGen): IdDocModel {
  const blocks = doc.content;
  const buffer = blocks.map((b) => b.content?.map((t) => t.text).join("") ?? "").join("\n");
  const blockAttrs: BlockAttr[] = blocks.map((b) =>
    b.type === "heading" ? { type: "heading", level: (b.attrs?.level ?? 1) as 1 | 2 | 3 } : { type: "paragraph" },
  );
  const blockIds = blocks.map((b) => (typeof b.attrs?.bid === "string" ? b.attrs.bid : mkId()));
  // 길이 정합(전부 mint 됐든 일부든 블록 수 = ID 수) 보장
  if (blockIds.length !== blocks.length) {
    return { buffer, blockAttrs, blockIds: mintIds(blocks.length, mkId) };
  }
  return { buffer, blockAttrs, blockIds };
}
