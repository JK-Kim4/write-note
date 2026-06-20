"use client";

/**
 * 화면 에디터(CustomEditor)와 PDF 인쇄 렌더(PrintDocument)가 공유하는 measure→layout + run 렌더.
 * CustomEditor 에서 동작 보존 추출(023-r7 Task 4) — 로직 변경 없음, 위치만 이동.
 */

import { type CSSProperties, type ReactNode } from "react";
import { blockFont, type PageGeometry } from "./geometry";
import { layout, type LaidOutPage, type MeasuredBlock, type MeasuredLine } from "./layoutEngine";
import { blockIndentPx, measureParagraphLines } from "./measure";
import { blockRuns, listNumberAt, MARK, SOFT_BREAK, type BlockAttr, type DocModel, type MarkRun, type Mask } from "./model";

export const FONT_FAMILY = "'Apple SD Gothic Neo', 'Noto Serif KR', serif";
export const OBJ = "￼"; // 이미지 마커
const IMG_NW = 600;
const IMG_NH = 400;
// SVG data URI 는 리터럴 문자열로(보간 ${} 넣으면 SWC 상수폴딩이 '/>' 유실 → SVG 깨짐, 2026-06-15).
export const IMG_SRC =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>" +
            "<rect width='600' height='400' fill='#e0e7ff'/>" +
            "<rect x='1' y='1' width='598' height='398' fill='none' stroke='#6366f1' stroke-width='2'/>" +
            "<text x='300' y='208' font-size='30' fill='#4338ca' text-anchor='middle' font-family='sans-serif'>이미지 · 가변 높이 블록</text>" +
            "</svg>",
    );

export type ParsedBlock =
    | {
          id: string;
          kind: "paragraph";
          text: string;
          lines: MeasuredLine[];
          /** 이 블록의 정규형 run-list — measure/caret/render 가 혼합폭·스타일에 공통 사용. */
          marks: MarkRun[];
          bufStart: number;
          bufEnd: number;
          fontSizePx: number;
          lineHeightPx: number;
          /** heading 블록이면 레벨(1·2·3), paragraph 이면 undefined. 아웃라인 data 속성 태깅에 사용. */
          headingLevel?: 1 | 2 | 3;
          /** 블록 속성 — 인용/목록/구분선 렌더·캐럿 보정에 사용. */
          attr: BlockAttr;
          /** 좌측 들여쓰기(px) — measure.blockIndentPx. 캐럿/선택 x 에 더하고 렌더 좌패딩에 쓴다. */
          indentPx: number;
          /** 번호목록이면 렌더 시 파생한 번호(1-based), 아니면 null. */
          listNumber: number | null;
      }
    | { id: string; kind: "image"; height: number; bufStart: number; bufEnd: number };

export type View = { blocks: ParsedBlock[]; pages: LaidOutPage[] };

/**
 * 모델 → 블록 파싱 + 측정 + 레이아웃. geo/모델 변경 시 재호출 = 리플로우.
 * 블록마다 blockFont(attr, geo) 로 폰트를 파생해 측정·캐럿·렌더에 관통한다(heading = 블록별 큰 폰트).
 */
export function relayout(model: DocModel, geo: PageGeometry): View {
    const segs = model.buffer.split("\n");
    const blocks: ParsedBlock[] = [];
    let off = 0;
    segs.forEach((seg, i) => {
        const bufStart = off;
        const bufEnd = off + seg.length;
        const id = "b" + i;
        if (seg === OBJ) {
            const scale = Math.min(1, geo.contentWidthPx / IMG_NW, geo.contentHeightPx / IMG_NH);
            blocks.push({ id, kind: "image", height: IMG_NH * scale, bufStart, bufEnd });
        } else {
            const attr: BlockAttr = model.blockAttrs[i] ?? { type: "paragraph" };
            const font = blockFont(attr, geo);
            const marks = blockRuns(model, i);
            const lines = measureParagraphLines(seg, marks, geo.contentWidthPx, font.lineHeightPx, font.fontSizePx, FONT_FAMILY, attr);
            const headingLevel: 1 | 2 | 3 | undefined = attr.type === "heading" ? attr.level : undefined;
            const indentPx = blockIndentPx(attr);
            const listNumber = listNumberAt(model, i);
            blocks.push({ id, kind: "paragraph", text: seg, lines, marks, bufStart, bufEnd, fontSizePx: font.fontSizePx, lineHeightPx: font.lineHeightPx, headingLevel, attr, indentPx, listNumber });
        }
        off = bufEnd + 1; // '\n' 구분자 1칸
    });
    const measured: MeasuredBlock[] = blocks.map((b) =>
        b.kind === "image" ? { kind: "image", id: b.id, height: b.height } : { kind: "paragraph", id: b.id, lines: b.lines },
    );
    return { blocks, pages: layout(measured, geo.contentHeightPx) };
}

/**
 * 블록 텍스트를 run 별 React 노드로 렌더. measure.ts 의 buildOffscreenDiv 와 동일 규칙:
 * - marks 가 비었거나 전부 mask 0 → 단일 텍스트노드(1라운드와 동일 렌더 = 무회귀).
 * - 그 외 → run 마다 style 있으면 <span>, 없으면(mask 0) 텍스트노드. 미덮 꼬리는 mask 0.
 * 스타일은 measure.ts maskToStyle 와 1:1(bold→700, italic, underline/strike→text-decoration).
 */
export function renderRuns(text: string, marks: MarkRun[]): ReactNode {
    if (text.length === 0) return text;
    // 소프트 줄바꿈 U+2028 → '\n' 로 표시(길이 보존). 브라우저는 U+2028 을 white-space:pre-wrap
    // 에서 신뢰성 있게 줄바꿈하지 않으나(measure 는 코드로 강제 분리) '\n' 은 확실히 줄바꿈한다.
    const disp = (s: string) => s.split(SOFT_BREAK).join("\n");
    const allZero = marks.length === 0 || marks.every((r) => r.mask === 0);
    if (allZero) return disp(text);

    const nodes: ReactNode[] = [];
    let pos = 0;
    let key = 0;
    for (const run of marks) {
        if (run.len <= 0) continue;
        const runText = text.slice(pos, pos + run.len);
        if (!runText) {
            pos += run.len;
            continue;
        }
        const style = maskToReactStyle(run.mask);
        if (style) nodes.push(<span key={key++} style={style}>{disp(runText)}</span>);
        else nodes.push(disp(runText));
        pos += run.len;
    }
    if (pos < text.length) nodes.push(disp(text.slice(pos)));
    return nodes;
}

/** mask → React 인라인 스타일. measure.ts maskToStyle 과 동일(빈 스타일이면 null = span 생략). */
function maskToReactStyle(mask: Mask): CSSProperties | null {
    const style: CSSProperties = {};
    let has = false;
    if (mask & MARK.bold) { style.fontWeight = 700; has = true; }
    if (mask & MARK.italic) { style.fontStyle = "italic"; has = true; }
    const deco: string[] = [];
    if (mask & MARK.underline) deco.push("underline");
    if (mask & MARK.strike) deco.push("line-through");
    if (deco.length > 0) { style.textDecoration = deco.join(" "); has = true; }
    return has ? style : null;
}
