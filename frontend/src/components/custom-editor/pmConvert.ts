/**
 * PM JSON ↔ 내부 DocModel 양방향 변환 (순수 함수, 무상태)
 *
 * - pmJsonToModel: ProseMirror JSON 문자열 → DocModel (marks 환원·정규화)
 * - modelToPmJson: DocModel → ProseMirror JSON 문자열 (run→text node marks)
 *
 * 왕복 무손실 보장 범위: paragraph + heading(1·2·3) + bold/italic/underline/strike.
 * 하위호환: 마크 없는 모델 → 1라운드와 바이트 동일 출력.
 */

import type { BlockAttr, DocModel, MarkRun, Mask } from "./model";
import { MARK } from "./model";

// ─── 내부 타입 ──────────────────────────────────────────────────────────────

type PmMark = { type: string; attrs?: Record<string, unknown> };

type PmNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: PmNode[];
  marks?: PmMark[];
};

// ─── 마크 타입 매핑 ──────────────────────────────────────────────────────────

const MASK_TO_PM: Array<[Mask, string]> = [
  [MARK.bold, "bold"],
  [MARK.italic, "italic"],
  [MARK.underline, "underline"],
  [MARK.strike, "strike"],
];

function maskToPmMarks(mask: Mask): PmMark[] {
  if (mask === 0) return [];
  return MASK_TO_PM.filter(([bit]) => mask & bit).map(([, type]) => ({ type }));
}

function pmMarkToMask(marks: PmMark[] | undefined): Mask {
  if (!marks || marks.length === 0) return 0;
  let mask = 0;
  for (const m of marks) {
    switch (m.type) {
      case "bold":
        mask |= MARK.bold;
        break;
      case "italic":
        mask |= MARK.italic;
        break;
      case "underline":
        mask |= MARK.underline;
        break;
      case "strike":
        mask |= MARK.strike;
        break;
      // 미지원 마크 무시
    }
  }
  return mask;
}

// ─── run-list 정규화 ─────────────────────────────────────────────────────────

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

// ─── 텍스트 + 마크 깊이우선 이어붙임 ────────────────────────────────────────

type TextChunk = { text: string; mask: Mask };

function chunksOf(node: PmNode): TextChunk[] {
  if (typeof node.text === "string") {
    return [{ text: node.text, mask: pmMarkToMask(node.marks) }];
  }
  if (!node.content) return [];
  return node.content.flatMap(chunksOf);
}

// ─── 평탄화 헬퍼 ─────────────────────────────────────────────────────────────

type FlatBlock = { text: string; attr: BlockAttr; runs: MarkRun[] };

function flattenNode(node: PmNode): FlatBlock[] {
  const type = node.type ?? "";

  if (type === "paragraph") {
    const chunks = chunksOf(node);
    const text = chunks.map((c) => c.text).join("");
    const runs = normalizeRuns(chunks.map((c) => ({ len: c.text.length, mask: c.mask })));
    return [{ text, attr: { type: "paragraph" }, runs }];
  }

  if (type === "heading") {
    const level = node.attrs?.["level"];
    const chunks = chunksOf(node);
    const text = chunks.map((c) => c.text).join("");
    const runs = normalizeRuns(chunks.map((c) => ({ len: c.text.length, mask: c.mask })));
    if (level === 1 || level === 2 || level === 3) {
      return [{ text, attr: { type: "heading", level }, runs }];
    }
    return [{ text, attr: { type: "paragraph" }, runs }];
  }

  if (type === "bulletList" || type === "orderedList") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" }, runs: [] }];
    }
    return children.flatMap(flattenNode);
  }

  if (type === "listItem") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" }, runs: [] }];
    }
    return children.flatMap(flattenNode);
  }

  if (type === "blockquote") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "paragraph" }, runs: [] }];
    }
    return children.flatMap(flattenNode);
  }

  // 그 외 (codeBlock, horizontalRule, image, …) → 텍스트 추출 paragraph
  const chunks = chunksOf(node);
  const text = chunks.map((c) => c.text).join("");
  return [{ text, attr: { type: "paragraph" }, runs: [] }];
}

// ─── 빈 모델 상수 (INV-3) ────────────────────────────────────────────────────

const EMPTY_MODEL: DocModel = {
  buffer: "",
  blockAttrs: [{ type: "paragraph" }],
  markRuns: [[]],
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
  if (blocks.length === 0) return EMPTY_MODEL;

  return {
    buffer: blocks.map((b) => b.text).join("\n"),
    blockAttrs: blocks.map((b) => b.attr),
    markRuns: blocks.map((b) => b.runs),
  };
}

// ─── modelToPmJson ────────────────────────────────────────────────────────────

export function modelToPmJson(model: DocModel): string {
  const segments = model.buffer.split("\n");

  const content: PmNode[] = segments.map((seg, i) => {
    const attr = model.blockAttrs[i] ?? { type: "paragraph" as const };
    // U+FFFC(이미지 마커) 세그먼트는 빈 paragraph 처리
    const text = seg === "￼" ? "" : seg;
    const runs = model.markRuns[i] ?? [];

    // 텍스트 노드 배열 생성 (run별 분할)
    const textNodes = _buildTextNodes(text, runs);

    if (attr.type === "heading") {
      return {
        type: "heading",
        attrs: { level: attr.level },
        ...(textNodes.length > 0 ? { content: textNodes } : {}),
      };
    }

    // paragraph (기본)
    return {
      type: "paragraph",
      ...(textNodes.length > 0 ? { content: textNodes } : {}),
    };
  });

  return JSON.stringify({ type: "doc", content });
}

/**
 * 텍스트 + run-list 에서 PmNode 배열 생성.
 * mask 0 run → marks 생략(1라운드 출력과 동일).
 */
function _buildTextNodes(text: string, runs: MarkRun[]): PmNode[] {
  if (!text) return [];

  // run이 비었거나 mask 0 단일 run이면 1라운드 동일 단일 text node
  if (runs.length === 0) {
    return [{ type: "text", text }];
  }

  // 전부 mask 0 이면 단일 text node (하위호환)
  const allZero = runs.every((r) => r.mask === 0);
  if (allZero) {
    return [{ type: "text", text }];
  }

  // run별 text node 생성
  const nodes: PmNode[] = [];
  let pos = 0;
  for (const run of runs) {
    if (run.len <= 0) continue;
    const runText = text.slice(pos, pos + run.len);
    if (!runText) { pos += run.len; continue; }
    const pmMarks = maskToPmMarks(run.mask);
    nodes.push({
      type: "text",
      text: runText,
      ...(pmMarks.length > 0 ? { marks: pmMarks } : {}),
    });
    pos += run.len;
  }

  // 혹시 runs 가 text 를 다 못 덮으면 나머지 mask 0 로 추가
  if (pos < text.length) {
    nodes.push({ type: "text", text: text.slice(pos) });
  }

  return nodes;
}
