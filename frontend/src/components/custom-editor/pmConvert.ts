/**
 * PM JSON ↔ 내부 DocModel 양방향 변환 (순수 함수, 무상태)
 *
 * - pmJsonToModel: ProseMirror JSON 문자열 → DocModel
 *   paragraph / heading(1·2·3) 은 직접 매핑, 그 외 노드는 lossy 평탄화.
 * - modelToPmJson: DocModel → ProseMirror JSON 문자열
 *   paragraph / heading 만 생성 (현행 StarterKit 상호운용 유지).
 *
 * 왕복 무손실 보장 범위: paragraph + heading(1·2·3) 만으로 구성된 DocModel.
 */

import type { BlockAttr, DocModel } from "./model";

// ─── 내부 타입 ──────────────────────────────────────────────────────────────

type PmNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: PmNode[];
  marks?: unknown[];
};

// ─── 텍스트 깊이우선 이어붙임 ────────────────────────────────────────────────

function textOf(node: PmNode): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(textOf).join("");
}

// ─── 평탄화 헬퍼 ─────────────────────────────────────────────────────────────

/**
 * 임의 PM 노드를 {text, attr} 블록 목록으로 평탄화.
 * - paragraph → 블록 1개 (텍스트 깊이우선 이어붙임)
 * - heading(1·2·3) → 블록 1개 (heading attr)
 * - listItem → 내부 content 재귀 → 보통 paragraph 로 귀결
 * - bulletList / orderedList → listItem 별 각각 재귀 (항목별 블록 분리)
 * - blockquote → 내부 content 재귀
 * - 그 외(codeBlock·horizontalRule·image 등) → 텍스트 추출 paragraph 블록 1개
 */
function flattenNode(node: PmNode): Array<{ text: string; attr: BlockAttr }> {
  const type = node.type ?? "";

  if (type === "paragraph") {
    return [{ text: textOf(node), attr: { type: "paragraph" } }];
  }

  if (type === "heading") {
    const level = node.attrs?.["level"];
    if (level === 1 || level === 2 || level === 3) {
      return [{ text: textOf(node), attr: { type: "heading", level } }];
    }
    // level 범위 밖 heading → paragraph 로 낮춤
    return [{ text: textOf(node), attr: { type: "paragraph" } }];
  }

  if (type === "bulletList" || type === "orderedList") {
    // 리스트 항목(listItem) 별 재귀
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" } }];
    }
    return children.flatMap(flattenNode);
  }

  if (type === "listItem") {
    // listItem 내부는 보통 paragraph 들 — 재귀
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" } }];
    }
    return children.flatMap(flattenNode);
  }

  if (type === "blockquote") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" } }];
    }
    return children.flatMap(flattenNode);
  }

  // 그 외 (codeBlock, horizontalRule, image, …) → 텍스트 추출 paragraph
  return [{ text: textOf(node), attr: { type: "paragraph" } }];
}

// ─── 빈 모델 상수 (INV-3) ────────────────────────────────────────────────────

const EMPTY_MODEL: DocModel = {
  buffer: "",
  blockAttrs: [{ type: "paragraph" }],
};

// ─── pmJsonToModel ────────────────────────────────────────────────────────────

export function pmJsonToModel(bodyJson: string): DocModel {
  if (!bodyJson) return EMPTY_MODEL;

  let parsed: PmNode;
  try {
    parsed = JSON.parse(bodyJson) as PmNode;
  } catch {
    return EMPTY_MODEL;
  }

  const topNodes = parsed.content ?? [];
  if (topNodes.length === 0) return EMPTY_MODEL;

  const blocks = topNodes.flatMap(flattenNode);
  // 결과가 없으면(예: 모든 노드가 0블록 반환했다면) 빈 모델
  if (blocks.length === 0) return EMPTY_MODEL;

  return {
    buffer: blocks.map((b) => b.text).join("\n"),
    blockAttrs: blocks.map((b) => b.attr),
  };
}

// ─── modelToPmJson ────────────────────────────────────────────────────────────

export function modelToPmJson(model: DocModel): string {
  const segments = model.buffer.split("\n");

  const content: PmNode[] = segments.map((seg, i) => {
    const attr = model.blockAttrs[i] ?? { type: "paragraph" as const };
    // U+FFFC(이미지 마커) 세그먼트는 이번 라운드에서 빈 paragraph 처리
    const text = seg === "￼" ? "" : seg;

    if (attr.type === "heading") {
      return {
        type: "heading",
        attrs: { level: attr.level },
        ...(text ? { content: [{ type: "text", text }] } : {}),
      };
    }

    // paragraph (기본)
    return {
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    };
  });

  return JSON.stringify({ type: "doc", content });
}
