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
