/**
 * PoC 자체 에디터 — 텍스트 줄 측정(브라우저). 오프스크린 렌더 + Range.getClientRects 로
 * 한 문단을 목표 폭에서 몇 줄로 흐르는지, 각 줄의 문자 범위를 구한다.
 *
 * 줄높이는 layout 과의 일관을 위해 geometry.lineHeightPx 로 통일(글리프 실측 대신 CSS line-height).
 * 성능: 키 입력마다 전체가 아니라 편집된 문단만 재측정(리서치 pitfall #1). PoC 는 마운트/규격변경 시 일괄.
 */

import type { MeasuredLine } from "./layoutEngine";

/**
 * 문단 텍스트를 목표 폭으로 줄 분해한다. 각 줄 = {height, start, end(문자 인덱스)}.
 * @param text 문단 평문(개행 없음 — 개행은 별도 문단 블록)
 * @param contentWidthPx 줄바꿈 기준 폭
 * @param lineHeightPx 줄높이(px)
 * @param fontSizePx 폰트 px
 * @param fontFamily 렌더와 동일해야 하는 폰트 패밀리 문자열
 */
export function measureParagraphLines(
    text: string,
    contentWidthPx: number,
    lineHeightPx: number,
    fontSizePx: number,
    fontFamily: string,
): MeasuredLine[] {
    if (text.length === 0) return [{ height: lineHeightPx, start: 0, end: 0 }];

    const el = document.createElement("div");
    el.style.cssText =
        `position:absolute;visibility:hidden;left:-99999px;top:0;` +
        `width:${contentWidthPx}px;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;` +
        `font-family:${fontFamily};white-space:pre-wrap;word-break:break-word;`;
    const node = document.createTextNode(text);
    el.appendChild(node);
    document.body.appendChild(el);

    const range = document.createRange();
    const lines: MeasuredLine[] = [];
    let curTop: number | null = null;
    let start = 0;
    // 문자별 rect 의 top 으로 같은 줄을 그룹핑 — top 이 바뀌면 새 줄.
    for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        if (curTop === null) {
            curTop = top;
            start = 0;
        } else if (top !== curTop) {
            lines.push({ height: lineHeightPx, start, end: i });
            curTop = top;
            start = i;
        }
    }
    lines.push({ height: lineHeightPx, start, end: text.length });

    document.body.removeChild(el);
    return lines;
}

/**
 * 한 줄 내 각 문자 경계의 x 오프셋(줄 시작 기준 px) 배열을 반환. xs[i] = lineStart..(lineStart+i) 의 advance.
 *
 * 캐럿 x·클릭 hit-test 에 쓴다. **canvas measureText 금지** — canvas 는 한글 폰트를 좁게 폴백 측정해
 * DOM 렌더와 어긋나 캐럿이 누적 드리프트한다(2026-06-15 사용자 보고). 줄바꿈·렌더와 같은 오프스크린
 * DOM(Range.getBoundingClientRect)으로 재야 픽셀 일치.
 */
export function measureLineXs(
    text: string,
    lineStart: number,
    lineEnd: number,
    contentWidthPx: number,
    lineHeightPx: number,
    fontSizePx: number,
    fontFamily: string,
): number[] {
    const el = document.createElement("div");
    el.style.cssText =
        `position:absolute;visibility:hidden;left:-99999px;top:0;` +
        `width:${contentWidthPx}px;font-size:${fontSizePx}px;line-height:${lineHeightPx}px;` +
        `font-family:${fontFamily};white-space:pre-wrap;word-break:break-word;`;
    const node = document.createTextNode(text);
    el.appendChild(node);
    document.body.appendChild(el);

    const range = document.createRange();
    const xs: number[] = [];
    for (let i = lineStart; i <= lineEnd; i++) {
        if (i === lineStart) {
            xs.push(0);
            continue;
        }
        range.setStart(node, lineStart);
        range.setEnd(node, i);
        xs.push(range.getBoundingClientRect().width);
    }

    document.body.removeChild(el);
    return xs;
}
