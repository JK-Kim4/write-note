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
import type { MarkRun } from "./model";

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
  el.style.cssText =
    `position:absolute;visibility:hidden;left:-99999px;top:0;` +
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
 * 문단 텍스트를 목표 폭으로 줄 분해한다. 각 줄 = {height, start, end(문자 인덱스)}.
 *
 * @param text     문단 평문(개행 없음)
 * @param marks    run-list (2라운드 추가 — 빈 배열 또는 단일 mask-0 run 이면 1라운드 동일)
 * @param contentWidthPx 줄바꿈 기준 폭
 * @param lineHeightPx   줄높이(px)
 * @param fontSizePx     폰트 px
 * @param fontFamily     렌더와 동일해야 하는 폰트 패밀리 문자열
 */
export function measureParagraphLines(
  text: string,
  marks: MarkRun[] = [],
  contentWidthPx: number,
  lineHeightPx: number,
  fontSizePx: number,
  fontFamily: string,
): MeasuredLine[] {
  if (text.length === 0) return [{ height: lineHeightPx, start: 0, end: 0 }];

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
  const lines: MeasuredLine[] = [];
  let curTop: number | null = null;
  let lineStart = 0;

  for (let i = 0; i < text.length; i++) {
    setRangeAt(range, spans, i, i + 1);
    const top = Math.round(range.getBoundingClientRect().top);
    if (curTop === null) {
      curTop = top;
      lineStart = 0;
    } else if (top !== curTop) {
      lines.push({ height: lineHeightPx, start: lineStart, end: i });
      curTop = top;
      lineStart = i;
    }
  }
  lines.push({ height: lineHeightPx, start: lineStart, end: text.length });

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
