/**
 * PM JSON ↔ 내부 DocModel 양방향 변환 (순수 함수, 무상태)
 *
 * - pmJsonToModel: ProseMirror JSON 문자열 → DocModel (marks 환원·정규화)
 * - modelToPmJson: DocModel → ProseMirror JSON 문자열 (run→text node marks)
 *
 * 왕복 무손실 보장 범위: paragraph + heading(1·2·3) + bold/italic/underline/strike
 *   + blockquote + bulletList/orderedList/listItem + horizontalRule + hardBreak.
 * 하위호환: 마크 없는 모델 → 1라운드와 바이트 동일 출력.
 */

import type { BlockAttr, DocModel, MarkRun, Mask } from "./model";
import { MARK, SOFT_BREAK } from "./model";

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
  if (node.type === "hardBreak") {
    return [{ text: SOFT_BREAK, mask: 0 }];
  }
  if (typeof node.text === "string") {
    return [{ text: node.text, mask: pmMarkToMask(node.marks) }];
  }
  if (!node.content) return [];
  return node.content.flatMap(chunksOf);
}

// ─── 평탄화 헬퍼 ─────────────────────────────────────────────────────────────

type FlatBlock = { text: string; attr: BlockAttr; runs: MarkRun[] };

/**
 * PmNode → FlatBlock 배열로 재귀 평탄화.
 * listDepth: 현재 중첩된 리스트 조상 수. 최상위 listItem = depth 0.
 * listKind: 현재 속한 리스트 종류 (null이면 리스트 외부).
 */
function flattenNode(node: PmNode, listDepth: number = 0, listKind: "bullet" | "ordered" | null = null): FlatBlock[] {
  const type = node.type ?? "";

  if (type === "paragraph") {
    const chunks = chunksOf(node);
    const text = chunks.map((c) => c.text).join("");
    const runs = normalizeRuns(chunks.filter((c) => c.text.length > 0).map((c) => ({ len: c.text.length, mask: c.mask })));

    // 리스트 내 paragraph는 listItem 블록으로 반환 (상위 flattenNode(listItem)이 위임)
    if (listKind !== null) {
      const attr: BlockAttr = { type: "listItem", listKind, depth: listDepth };
      return [{ text, attr, runs }];
    }
    return [{ text, attr: { type: "paragraph" }, runs }];
  }

  if (type === "heading") {
    const level = node.attrs?.["level"];
    const chunks = chunksOf(node);
    const text = chunks.map((c) => c.text).join("");
    const runs = normalizeRuns(chunks.filter((c) => c.text.length > 0).map((c) => ({ len: c.text.length, mask: c.mask })));
    if (level === 1 || level === 2 || level === 3) {
      return [{ text, attr: { type: "heading", level }, runs }];
    }
    return [{ text, attr: { type: "paragraph" }, runs }];
  }

  if (type === "bulletList") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "listItem", listKind: "bullet", depth: listDepth }, runs: [] }];
    }
    // 중첩 리스트: listDepth는 이미 listItem 안에서 올라온다 (아래 listItem 처리 참고)
    return children.flatMap((child) => flattenNode(child, listDepth, "bullet"));
  }

  if (type === "orderedList") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "listItem", listKind: "ordered", depth: listDepth }, runs: [] }];
    }
    return children.flatMap((child) => flattenNode(child, listDepth, "ordered"));
  }

  if (type === "listItem") {
    // listItem의 content는 [paragraph, (중첩 list)?] 구조.
    // paragraph → listItem 블록(현재 depth, listKind)
    // 중첩 list → depth+1 로 재귀
    const children = node.content ?? [];
    if (children.length === 0) {
      const attr: BlockAttr = listKind !== null
        ? { type: "listItem", listKind, depth: listDepth }
        : { type: "paragraph" };
      return [{ text: "", attr, runs: [] }];
    }

    const blocks: FlatBlock[] = [];
    for (const child of children) {
      if (child.type === "bulletList" || child.type === "orderedList") {
        // 중첩 리스트: depth+1
        const nestedKind: "bullet" | "ordered" = child.type === "bulletList" ? "bullet" : "ordered";
        const nestedChildren = child.content ?? [];
        for (const nestedItem of nestedChildren) {
          blocks.push(...flattenNode(nestedItem, listDepth + 1, nestedKind));
        }
      } else {
        blocks.push(...flattenNode(child, listDepth, listKind));
      }
    }
    return blocks;
  }

  if (type === "blockquote") {
    const children = node.content ?? [];
    if (children.length === 0) {
      return [{ text: "", attr: { type: "blockquote" }, runs: [] }];
    }
    // blockquote 내 paragraph → blockquote 블록으로 변환 (여러 paragraph면 각각 blockquote 블록)
    return children.flatMap((child) => {
      if (child.type === "paragraph") {
        const chunks = chunksOf(child);
        const text = chunks.map((c) => c.text).join("");
        const runs = normalizeRuns(chunks.filter((c) => c.text.length > 0).map((c) => ({ len: c.text.length, mask: c.mask })));
        return [{ text, attr: { type: "blockquote" } as BlockAttr, runs }];
      }
      return flattenNode(child);
    });
  }

  if (type === "horizontalRule") {
    return [{ text: "", attr: { type: "hr" }, runs: [] }];
  }

  // 그 외 (codeBlock, image, …) → 텍스트 추출 paragraph (미지원 노드 평탄화)
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

  const blocks = topNodes.flatMap((node) => flattenNode(node));
  if (blocks.length === 0) return EMPTY_MODEL;

  return {
    buffer: blocks.map((b) => b.text).join("\n"),
    blockAttrs: blocks.map((b) => b.attr),
    markRuns: blocks.map((b) => b.runs),
  };
}

// ─── modelToPmJson ────────────────────────────────────────────────────────────

/**
 * 텍스트 + run-list 에서 PmNode 배열 생성 (SOFT_BREAK → hardBreak 포함).
 */
function _buildParagraphContent(text: string, runs: MarkRun[]): PmNode[] {
  if (!text) return [];

  // SOFT_BREAK가 없고 단순 텍스트면 기존 로직
  if (!text.includes(SOFT_BREAK)) {
    return _buildTextNodes(text, runs);
  }

  // SOFT_BREAK가 있으면 분할해서 hardBreak 삽입
  const nodes: PmNode[] = [];
  const segments = text.split(SOFT_BREAK);

  // run-list를 SOFT_BREAK 위치로 분할
  let runPos = 0;
  const allRuns = runs.length > 0 ? runs : [{ len: text.length, mask: 0 }];
  // SOFT_BREAK 포함 전체 텍스트에서 실제 run 분리
  // SOFT_BREAK도 len 1로 처리됐으므로 run-list 기준 분할 필요
  let runsRemaining = [...allRuns];

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    // seg에 해당하는 run slice 추출
    const segRuns: MarkRun[] = [];
    let needed = seg.length;
    while (needed > 0 && runsRemaining.length > 0) {
      const head = runsRemaining[0];
      if (head.len <= needed) {
        segRuns.push({ ...head });
        needed -= head.len;
        runsRemaining = runsRemaining.slice(1);
      } else {
        segRuns.push({ len: needed, mask: head.mask });
        runsRemaining[0] = { len: head.len - needed, mask: head.mask };
        needed = 0;
      }
    }

    // 세그먼트 텍스트 노드
    const segNodes = _buildTextNodes(seg, segRuns);
    nodes.push(...segNodes);

    // SOFT_BREAK 소비 (run에서 len 1 제거)
    if (si < segments.length - 1) {
      nodes.push({ type: "hardBreak" });
      // SOFT_BREAK는 run에서 1글자이므로 소비
      if (runsRemaining.length > 0) {
        const head = runsRemaining[0];
        if (head.len === 1) {
          runsRemaining = runsRemaining.slice(1);
        } else {
          runsRemaining[0] = { len: head.len - 1, mask: head.mask };
        }
      }
    }

    runPos += seg.length + (si < segments.length - 1 ? 1 : 0);
  }

  return nodes;
}

/**
 * DocModel → ProseMirror JSON 문자열.
 * blockquote/listItem/hr/SOFT_BREAK 신규 지원.
 */
export function modelToPmJson(model: DocModel): string {
  const segments = model.buffer.split("\n");

  // 블록별 원시 정보 수집
  type RawBlock = {
    attr: BlockAttr;
    text: string;
    runs: MarkRun[];
  };

  const rawBlocks: RawBlock[] = segments.map((seg, i) => {
    const attr = model.blockAttrs[i] ?? { type: "paragraph" as const };
    const text = seg === "￼" ? "" : seg;
    const runs = model.markRuns[i] ?? [];
    return { attr, text, runs };
  });

  // listItem 재그룹: 연속된 (listKind, depth) listItem → 중첩 bulletList/orderedList 복원
  const content: PmNode[] = _groupBlocksToPmNodes(rawBlocks);

  return JSON.stringify({ type: "doc", content });
}

/**
 * RawBlock 배열을 PM 노드 배열로 변환.
 * listItem 연속 그룹을 재귀적으로 중첩 list 복원.
 */
function _groupBlocksToPmNodes(blocks: Array<{ attr: BlockAttr; text: string; runs: MarkRun[] }>): PmNode[] {
  const result: PmNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const { attr, text, runs } = blocks[i];

    if (attr.type === "listItem") {
      // listItem 시작 — 연속된 같은 최상위 listKind/depth 그룹 수집
      const groupKind = attr.listKind;
      const groupDepth = attr.depth;
      // 같은 depth의 listItem들을 수집 (depth > groupDepth인 것도 포함 — 중첩)
      const group: typeof blocks = [];
      while (i < blocks.length) {
        const a = blocks[i].attr;
        if (a.type === "listItem" && a.depth >= groupDepth) {
          // 같은 depth이거나 더 깊은 것 포함 (하지만 같은 depth의 다른 listKind는 종료)
          if (a.depth === groupDepth && a.listKind !== groupKind) break;
          group.push(blocks[i]);
          i++;
        } else {
          break;
        }
      }

      const listNode = _buildListNode(group, groupKind, groupDepth);
      result.push(listNode);
    } else {
      result.push(_buildSingleNode(attr, text, runs));
      i++;
    }
  }

  return result;
}

/**
 * listItem 블록 그룹 → bulletList/orderedList PmNode (중첩 복원).
 */
function _buildListNode(
  blocks: Array<{ attr: BlockAttr; text: string; runs: MarkRun[] }>,
  listKind: "bullet" | "ordered",
  depth: number,
): PmNode {
  const listType = listKind === "bullet" ? "bulletList" : "orderedList";
  const listItemNodes: PmNode[] = [];

  let i = 0;
  while (i < blocks.length) {
    const { attr, text, runs } = blocks[i];
    if (attr.type !== "listItem") { i++; continue; }

    if (attr.depth === depth && attr.listKind === listKind) {
      // 현재 depth의 listItem — paragraph 포함한 listItem 노드 생성
      const paraContent = _buildParagraphContent(text, runs);
      const paraNode: PmNode = { type: "paragraph", ...(paraContent.length > 0 ? { content: paraContent } : {}) };
      const listItemContent: PmNode[] = [paraNode];

      // 다음 블록들이 depth+1이면 중첩 목록으로 처리
      i++;
      const nestedBlocks: typeof blocks = [];
      while (i < blocks.length) {
        const nextAttr = blocks[i].attr;
        if (nextAttr.type === "listItem" && nextAttr.depth > depth) {
          nestedBlocks.push(blocks[i]);
          i++;
        } else {
          break;
        }
      }

      if (nestedBlocks.length > 0) {
        // 중첩 그룹을 listKind별로 재귀 처리
        let ni = 0;
        while (ni < nestedBlocks.length) {
          const na = nestedBlocks[ni].attr;
          if (na.type === "listItem") {
            const nestedKind = na.listKind;
            const nestedDepth = na.depth;
            const nestedGroup: typeof blocks = [];
            while (ni < nestedBlocks.length) {
              const nb = nestedBlocks[ni].attr;
              if (nb.type === "listItem" && nb.depth >= nestedDepth) {
                if (nb.depth === nestedDepth && nb.listKind !== nestedKind) break;
                nestedGroup.push(nestedBlocks[ni]);
                ni++;
              } else {
                break;
              }
            }
            listItemContent.push(_buildListNode(nestedGroup, nestedKind, nestedDepth));
          } else {
            ni++;
          }
        }
      }

      listItemNodes.push({ type: "listItem", content: listItemContent });
    } else {
      // depth/listKind 불일치 — 건너뜀 (shouldnt happen with grouping)
      i++;
    }
  }

  return { type: listType, content: listItemNodes };
}

/**
 * 단일 비-listItem 블록 → PM 노드.
 */
function _buildSingleNode(attr: BlockAttr, text: string, runs: MarkRun[]): PmNode {
  if (attr.type === "hr") {
    return { type: "horizontalRule" };
  }

  if (attr.type === "blockquote") {
    const paraContent = _buildParagraphContent(text, runs);
    const paraNode: PmNode = { type: "paragraph", ...(paraContent.length > 0 ? { content: paraContent } : {}) };
    return { type: "blockquote", content: [paraNode] };
  }

  if (attr.type === "heading") {
    const textNodes = _buildTextNodes(text, runs);
    return {
      type: "heading",
      attrs: { level: attr.level },
      ...(textNodes.length > 0 ? { content: textNodes } : {}),
    };
  }

  // paragraph (기본)
  const textNodes = _buildParagraphContent(text, runs);
  return {
    type: "paragraph",
    ...(textNodes.length > 0 ? { content: textNodes } : {}),
  };
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
