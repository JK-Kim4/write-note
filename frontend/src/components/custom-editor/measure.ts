/**
 * PoC 자체 에디터 — 텍스트 줄 측정(브라우저). 오프스크린 렌더 + Range.getClientRects 로
 * 한 문단을 목표 폭에서 몇 줄로 흐르는지, 각 줄의 문자 범위를 구한다.
 *
 * 줄높이는 layout 과의 일관을 위해 geometry.lineHeightPx 로 통일(글리프 실측 대신 CSS line-height).
 * 성능: 키 입력마다 전체가 아니라 편집된 문단만 재측정(리서치 pitfall #1). PoC 는 마운트/규격변경 시 일괄.
 *
 * 2라운드: marks: MarkRun[] 인자 추가 — run 마다 <span> 스타일 적용.
 * canvas 금지 (한글 폰트 측정 드리프트 회귀룰).
 */

import type { MeasuredLine } from "./layoutEngine";
import type { BlockAttr, MarkRun } from "./model";
import { SOFT_BREAK } from "./model";

// ─── 블록 타입별 폭 조정 상수 ────────────────────────────────────────────────
/** 인용(blockquote) 좌측 들여쓰기 px */
export const QUOTE_INDENT_PX = 32;
/** 글머리/번호 마커 폭 px */
export const MARKER_W_PX = 24;
/** 목록 depth 당 들여쓰기 px */
export const INDENT_STEP_PX = 20;

// ─── 스타일 헬퍼 ────────────────────────────────────────────────────────────

/**
 * mask 비트에서 span 인라인 스타일 생성.
 * bold→font-weight:700, italic→font-style:italic, underline/strike→text-decoration.
 */
function maskToStyle(mask: number): string {
  const parts: string[] = [];
  if (mask & 1) parts.push("font-weight:700");
  if (mask & 2) parts.push("font-style:italic");
  const deco: string[] = [];
  if (mask & 4) deco.push("underline");
  if (mask & 8) deco.push("line-through");
  if (deco.length > 0) parts.push(`text-decoration:${deco.join(" ")}`);
  return parts.join(";");
}

// ─── 오프스크린 div 구성 ─────────────────────────────────────────────────────

type SpanInfo = { node: Text; start: number; end: number };

/**
 * text + marks 를 run 별 <span> 으로 구성한 오프스크린 div 를 생성.
 * 반환: { el, spans } — el 을 DOM 에 붙인 뒤 사용, 끝나면 제거.
 */
function buildOffscreenDiv(
  text: string,
  marks: MarkRun[],
  contentWidthPx: number,
  lineHeightPx: number,
  fontSizePx: number,
  fontFamily: string,
): { el: HTMLDivElement; spans: SpanInfo[] } {
  const el = document.createElement("div");
  // 화면 밖(left:-99999px)으로 숨긴다. visibility:hidden 은 쓰지 않는다 — iOS WebKit 은 visibility:hidden
  // 요소의 Range.getBoundingClientRect 를 0 으로 주어 줄측정·x측정이 통째로 깨진다(줄바꿈 안 됨/글자 겹침).
  el.style.cssText =
    `position:absolute;left:-99999px;top:0;` +
    `width:${contentWidthPx}px;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;` +
    `font-family:${fontFamily};white-space:pre-wrap;word-break:break-word;`;

  const spans: SpanInfo[] = [];

  if (text.length === 0) {
    return { el, spans };
  }

  // marks 가 비었거나 전부 mask 0 이면 단일 텍스트노드 (1라운드 동일)
  const allZero = marks.length === 0 || marks.every((r) => r.mask === 0);

  if (allZero) {
    const node = document.createTextNode(text);
    el.appendChild(node);
    spans.push({ node, start: 0, end: text.length });
  } else {
    // run 별 <span>
    let pos = 0;
    for (const run of marks) {
      if (run.len <= 0) continue;
      const runText = text.slice(pos, pos + run.len);
      if (!runText) { pos += run.len; continue; }

      const style = maskToStyle(run.mask);
      const node = document.createTextNode(runText);

      if (style) {
        const span = document.createElement("span");
        span.style.cssText = style;
        span.appendChild(node);
        el.appendChild(span);
      } else {
        el.appendChild(node);
      }

      spans.push({ node, start: pos, end: pos + run.len });
      pos += run.len;
    }

    // runs 가 text 를 다 못 덮으면 나머지 mask 0
    if (pos < text.length) {
      const node = document.createTextNode(text.slice(pos));
      el.appendChild(node);
      spans.push({ node, start: pos, end: text.length });
    }
  }

  return { el, spans };
}

/**
 * 전체 텍스트 오프셋 i 에서 Range 를 설정. span 경계를 가로지름.
 */
function setRangeAt(
  range: Range,
  spans: SpanInfo[],
  start: number,
  end: number,
): void {
  const startSpan = spans.find((s) => start >= s.start && start < s.end) ?? spans[spans.length - 1];
  const endSpan = spans.find((s) => end > s.start && end <= s.end) ?? spans[spans.length - 1];

  if (!startSpan || !endSpan) return;

  range.setStart(startSpan.node, start - startSpan.start);
  range.setEnd(endSpan.node, end - endSpan.start);
}

// ─── measureParagraphLines ────────────────────────────────────────────────────

/**
 * blockAttr 에 따라 실제 측정에 쓸 콘텐츠 폭을 계산.
 */
function effectiveWidth(contentWidthPx: number, blockAttr: BlockAttr): number {
  return contentWidthPx - blockIndentPx(blockAttr);
}

/**
 * 블록의 좌측 들여쓰기(px) — 텍스트가 콘텐츠 좌단에서 얼마나 밀리는가.
 * 렌더(좌측 패딩)·캐럿/선택 x 보정·줄나눔 폭(effectiveWidth)이 공유하는 단일 출처.
 * - blockquote: 인용선+들여쓰기
 * - listItem: 마커 폭 + depth 단계 들여쓰기
 * - 그 외: 0
 */
export function blockIndentPx(blockAttr: BlockAttr): number {
  if (blockAttr.type === "blockquote") return QUOTE_INDENT_PX;
  if (blockAttr.type === "listItem") return MARKER_W_PX + blockAttr.depth * INDENT_STEP_PX;
  return 0;
}

/**
 * 문단 텍스트를 목표 폭으로 줄 분해한다. 각 줄 = {height, start, end(문자 인덱스)}.
 *
 * @param text       문단 평문(개행 없음, U+2028 소프트 줄바꿈 포함 가능)
 * @param marks      run-list (2라운드 추가 — 빈 배열 또는 단일 mask-0 run 이면 1라운드 동일)
 * @param contentWidthPx 줄바꿈 기준 폭
 * @param lineHeightPx   줄높이(px)
 * @param fontSizePx     폰트 px
 * @param fontFamily     렌더와 동일해야 하는 폰트 패밀리 문자열
 * @param blockAttr  블록 속성 (3라운드 추가 — 생략 시 paragraph 동일)
 */
export function measureParagraphLines(
  text: string,
  marks: MarkRun[] = [],
  contentWidthPx: number,
  lineHeightPx: number,
  fontSizePx: number,
  fontFamily: string,
  blockAttr: BlockAttr = { type: "paragraph" },
): MeasuredLine[] {
  // hr: 줄 1개(텍스트 0)
  if (blockAttr.type === "hr") {
    return [{ height: lineHeightPx, start: 0, end: 0 }];
  }

  if (text.length === 0) return [{ height: lineHeightPx, start: 0, end: 0 }];

  const usableWidth = effectiveWidth(contentWidthPx, blockAttr);

  const { el, spans } = buildOffscreenDiv(
    text,
    marks,
    usableWidth,
    lineHeightPx,
    fontSizePx,
    fontFamily,
  );
  document.body.appendChild(el);

  const range = document.createRange();
  const lines: MeasuredLine[] = [];
  let curTop: number | null = null;
  let lineStart = 0;

  for (let i = 0; i < text.length; i++) {
    // U+2028: 해당 offset에서 강제 줄 종료
    if (text[i] === SOFT_BREAK) {
      // 현재 줄 종료 (U+2028 직전까지)
      if (curTop === null) {
        curTop = 0;
      }
      lines.push({ height: lineHeightPx, start: lineStart, end: i });
      lineStart = i + 1; // 다음 줄은 U+2028 다음 문자부터
      curTop = null; // 다음 문자에서 top 재설정
      continue;
    }

    setRangeAt(range, spans, i, i + 1);
    const top = Math.round(range.getBoundingClientRect().top);
    if (curTop === null) {
      curTop = top;
    } else if (top !== curTop) {
      lines.push({ height: lineHeightPx, start: lineStart, end: i });
      curTop = top;
      lineStart = i;
    }
  }
  // 마지막 줄 (lineStart > text.length 이면 U+2028 이 마지막 문자인 경우 — 빈 줄 추가)
  if (lineStart <= text.length) {
    lines.push({ height: lineHeightPx, start: lineStart, end: text.length });
  }

  document.body.removeChild(el);
  return lines;
}

// ─── measureLineXs ────────────────────────────────────────────────────────────

/**
 * 한 줄 내 각 문자 경계의 x 오프셋(줄 시작 기준 px) 배열을 반환.
 * xs[i] = lineStart..(lineStart+i) 의 advance.
 *
 * @param text       전체 블록 텍스트
 * @param marks      run-list (2라운드 추가)
 * @param lineStart  줄 시작 인덱스
 * @param lineEnd    줄 끝 인덱스
 * @param contentWidthPx 폭
 * @param lineHeightPx   줄높이
 * @param fontSizePx     폰트
 * @param fontFamily     폰트 패밀리
 *
 * canvas measureText 금지 — DOM Range 로 측정해야 픽셀 일치 (2026-06-15 회귀룰).
 */
export function measureLineXs(
  text: string,
  marks: MarkRun[] = [],
  lineStart: number,
  lineEnd: number,
  contentWidthPx: number,
  lineHeightPx: number,
  fontSizePx: number,
  fontFamily: string,
): number[] {
  const { el, spans } = buildOffscreenDiv(
    text,
    marks,
    contentWidthPx,
    lineHeightPx,
    fontSizePx,
    fontFamily,
  );
  document.body.appendChild(el);

  const range = document.createRange();
  const xs: number[] = [];

  for (let i = lineStart; i <= lineEnd; i++) {
    if (i === lineStart) {
      xs.push(0);
      continue;
    }
    setRangeAt(range, spans, lineStart, i);
    xs.push(range.getBoundingClientRect().width);
  }

  document.body.removeChild(el);
  return xs;
}
