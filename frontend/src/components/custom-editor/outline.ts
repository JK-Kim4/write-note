/**
 * 자체 에디터 — DocModel 에서 아웃라인(목차)을 파생한다(순수).
 *
 * TipTap ProseMirror 기반 outlineFromDoc(@/lib/editor/outline.ts)과 달리
 * DocModel.buffer/blockAttrs 를 직접 순회해 파생한다.
 */

import type { DocModel } from "./model";
import type { OutlineItem } from "@/lib/editor/outline";

export type { OutlineItem };

/**
 * heading 블록을 등장순으로 OutlineItem[] 로 파생한다.
 *
 * - text: buffer 를 '\n' 으로 분리한 각 블록 텍스트
 * - index: heading 등장 순번(0-base, paragraph 는 카운트하지 않음)
 * - 빈 텍스트 heading 도 포함
 */
export function outlineFromModel(model: DocModel): OutlineItem[] {
  const blocks = model.buffer.split("\n");
  const items: OutlineItem[] = [];

  for (let i = 0; i < model.blockAttrs.length; i++) {
    const attr = model.blockAttrs[i];
    if (attr.type === "heading") {
      items.push({
        level: attr.level,
        text: blocks[i] ?? "",
        index: items.length,
      });
    }
  }

  return items;
}

/**
 * heading 이 위치한 블록 인덱스를 등장순 배열로 반환한다.
 *
 * useCustomOutline 이 view 좌표와 결합해 스크롤 위치를 해결하는 데 사용.
 */
export function headingBlockIndices(model: DocModel): number[] {
  const indices: number[] = [];
  for (let i = 0; i < model.blockAttrs.length; i++) {
    if (model.blockAttrs[i].type === "heading") {
      indices.push(i);
    }
  }
  return indices;
}
