/**
 * PoC 자체 에디터 — 페이지 기하(순수). 실제 용지 mm 비율 기반 px.
 *
 * 현 집필 에디터의 stylized "28줄 모델"(sheet≈256mm≠297mm)을 폐기 — 사용자 "A4 비율" 불만 해소.
 * 줄높이는 fontSize×ratio 로 분수 허용(레이아웃 엔진이 px 로 다루므로 정수 강제 불필요 = 폰트 크기 자유).
 */

/** 지원 용지 — portrait. */
export type PaperSize = "A5" | "A4" | "B4" | "A3";

/** 용지 실측 mm (가로×세로, portrait). */
const PAPER_MM: Record<PaperSize, { widthMm: number; heightMm: number }> = {
    A5: { widthMm: 148, heightMm: 210 },
    A4: { widthMm: 210, heightMm: 297 },
    B4: { widthMm: 257, heightMm: 364 }, // JIS B4
    A3: { widthMm: 297, heightMm: 420 },
};

/** CSS mm → px (96dpi 기준). */
const MM_TO_PX = 96 / 25.4;

/** 페이지 균일 마진(mm) — PoC 단순화(상하좌우 동일). */
const MARGIN_MM = 25;

/** 페이지 기하 파생값(px). contentWidthPx 는 측정(줄바꿈 폭), contentHeightPx 는 레이아웃(분할)에 쓰임. */
export type PageGeometry = {
    pageWidthPx: number;
    pageHeightPx: number;
    contentWidthPx: number;
    contentHeightPx: number;
    fontSizePx: number;
    lineHeightPx: number;
};

/**
 * 용지·폰트로부터 페이지 기하를 계산한다(순수). 규격/폰트 변경 = 본 함수 재호출 1회.
 * @param size 용지 크기
 * @param fontSizePx 본문 폰트 px
 * @param lineHeightRatio 줄높이 배수(기본 1.8) — fontSize×ratio, 분수 허용
 */
export function pageGeometry(size: PaperSize, fontSizePx: number, lineHeightRatio = 1.8): PageGeometry {
    const { widthMm, heightMm } = PAPER_MM[size];
    const pageWidthPx = widthMm * MM_TO_PX;
    const pageHeightPx = heightMm * MM_TO_PX;
    const marginPx = MARGIN_MM * MM_TO_PX;
    return {
        pageWidthPx,
        pageHeightPx,
        contentWidthPx: pageWidthPx - 2 * marginPx,
        contentHeightPx: pageHeightPx - 2 * marginPx,
        fontSizePx,
        lineHeightPx: fontSizePx * lineHeightRatio,
    };
}

/** 용지 라벨(배지·셀렉터용). */
export function paperLabel(size: PaperSize): string {
    const { widthMm, heightMm } = PAPER_MM[size];
    return `${size} · ${widthMm}×${heightMm}mm`;
}

export const PAPER_SIZES: readonly PaperSize[] = ["A5", "A4", "B4", "A3"] as const;
