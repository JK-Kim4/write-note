/**
 * PoC 자체 에디터 — 페이지 기하(순수). 실제 용지 mm 비율 기반 px.
 *
 * 현 집필 에디터의 stylized "28줄 모델"(sheet≈256mm≠297mm)을 폐기 — 사용자 "A4 비율" 불만 해소.
 * 줄높이는 fontSize×ratio 로 분수 허용(레이아웃 엔진이 px 로 다루므로 정수 강제 불필요 = 폰트 크기 자유).
 */

import type { BlockAttr } from "./model";

/** 지원 용지 — portrait. ISO 규격 + 출판 판형(031). */
export type PaperSize = "A5" | "A4" | "B4" | "A3" | "A2" | "sinkukpan" | "kukpan" | "pan46" | "mungopan";

/** 출판 판형(031) — 한국 소설 단행본 4종(ASCII 식별자, 표시 라벨은 [PAPER_LABEL]). */
export type PublicationFormat = "sinkukpan" | "kukpan" | "pan46" | "mungopan";

const PUBLICATION_FORMATS: ReadonlySet<PaperSize> = new Set<PaperSize>(["sinkukpan", "kukpan", "pan46", "mungopan"]);

/** 출판 판형 여부(031). 판형이면 출판 표준 폰트·여백을 쓴다. */
export function isPublicationFormat(size: PaperSize): boolean {
    return PUBLICATION_FORMATS.has(size);
}

/** 용지 실측 mm (가로×세로, portrait). */
const PAPER_MM: Record<PaperSize, { widthMm: number; heightMm: number }> = {
    A5: { widthMm: 148, heightMm: 210 },
    A4: { widthMm: 210, heightMm: 297 },
    B4: { widthMm: 257, heightMm: 364 }, // JIS B4
    A3: { widthMm: 297, heightMm: 420 },
    A2: { widthMm: 420, heightMm: 594 },
    // 출판 판형(031) — 재단 크기
    sinkukpan: { widthMm: 152, heightMm: 225 }, // 신국판
    kukpan: { widthMm: 148, heightMm: 210 }, // 국판
    pan46: { widthMm: 128, heightMm: 188 }, // 46판
    mungopan: { widthMm: 105, heightMm: 148 }, // 문고판
};

/** 판형 표시 라벨(한글) — 셀렉터·배지용. */
export const PAPER_LABEL: Record<PaperSize, string> = {
    A5: "A5",
    A4: "A4",
    B4: "B4",
    A3: "A3",
    A2: "A2",
    sinkukpan: "신국판",
    kukpan: "국판",
    pan46: "46판",
    mungopan: "문고판",
};

/** CSS mm → px (96dpi 기준). */
const MM_TO_PX = 96 / 25.4;

/**
 * 용지별 여백(mm). ISO 는 기존 25mm 유지(회귀 무변), 판형은 단행본 관행 여백.
 * 연구 D2 — 폰트·행간 공통, 여백·크기만 판형별로 분량 차이 발생. dogfooding 보정 대상.
 */
const MARGIN_MM_BY_SIZE: Record<PaperSize, number> = {
    A5: 25,
    A4: 25,
    B4: 25,
    A3: 25,
    A2: 25,
    sinkukpan: 18,
    kukpan: 18,
    pan46: 15,
    mungopan: 12,
};

/** 출판 표준 본문 폰트(px) — 판형 공통 ≈ 11.25pt(분량 환산 관행 11pt와 정합). */
const PUBLICATION_FONT_PX = 15;
/** ISO 규격 기존 본문 폰트(px) — 회귀 무변. */
const ISO_FONT_PX = 18;

/**
 * 용지별 권장 본문 폰트(px). 판형=출판 표준(작은) 폰트, ISO=기존 18px.
 * 화면 가독성은 CustomEditor 의 userZoom 으로 확대 흡수(신규 메커니즘 없음).
 */
export function recommendedFontPx(size: PaperSize): number {
    return isPublicationFormat(size) ? PUBLICATION_FONT_PX : ISO_FONT_PX;
}

/** 작품별 글자 크기 5단(031 US5). 'm'(보통)=판형 기본. */
export type FontScale = "xs" | "s" | "m" | "l" | "xl";

/** 5단 배수 — 판형 기본 폰트 위에 작가가 덮어쓰는 스케일. m=1.0(그대로). */
const FONT_SCALE_MULTIPLIER: Record<FontScale, number> = {
    xs: 0.8,
    s: 0.9,
    m: 1.0,
    l: 1.15,
    xl: 1.3,
};

/** 셀렉터 노출 순서(아주작게→아주크게). */
export const FONT_SCALE_ORDER: readonly FontScale[] = ["xs", "s", "m", "l", "xl"] as const;

/** 5단 표시 라벨(한글). */
export const FONT_SCALE_LABEL: Record<FontScale, string> = {
    xs: "아주작게",
    s: "작게",
    m: "보통",
    l: "크게",
    xl: "아주크게",
};

/**
 * 용지(판형 기본 폰트) + 글자 크기 5단으로 실효 본문 폰트(px)를 구한다(순수).
 * = round(recommendedFontPx(size) × 배수). 'm'이면 판형 기본 그대로(덮어쓰기 없음).
 * 데스크탑·모바일 동일하게 이 값을 fontSizePx 로 쓴다.
 */
export function fontPxFor(size: PaperSize, scale: FontScale): number {
    return Math.round(recommendedFontPx(size) * FONT_SCALE_MULTIPLIER[scale]);
}

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
    const marginPx = MARGIN_MM_BY_SIZE[size] * MM_TO_PX;
    return {
        pageWidthPx,
        pageHeightPx,
        contentWidthPx: pageWidthPx - 2 * marginPx,
        contentHeightPx: pageHeightPx - 2 * marginPx,
        fontSizePx,
        lineHeightPx: fontSizePx * lineHeightRatio,
    };
}

/** 모바일 페이지 마진 비율 — 폭 대비(25mm 고정은 폰에서 과함). */
const MOBILE_MARGIN_RATIO = 0.06;

/** A4 세로/가로 비율 — 모바일 페이지도 동일 비율 유지(여전히 "종이"·페이지 분할). */
const A4_ASPECT = PAPER_MM.A4.heightMm / PAPER_MM.A4.widthMm;

/**
 * 모바일 reflow 페이지 기하(순수). 데스크탑 A4 를 transform 으로 축소하는 대신,
 * 페이지 폭을 화면 가용 폭에 맞춰 글자를 원본 크기로 렌더하고 줄을 reflow 한다.
 * 페이지 세로는 A4 비율을 유지해 여전히 종이처럼 보이고 페이지 분할이 일어난다.
 * @param availWidthPx 화면 가용 폭(px) = 페이지 폭
 * @param fontSizePx 본문 폰트 px(축소 없이 그대로)
 * @param lineHeightRatio 줄높이 배수(기본 1.8)
 */
export function mobilePageGeometry(availWidthPx: number, fontSizePx: number, lineHeightRatio = 1.8): PageGeometry {
    const pageWidthPx = availWidthPx;
    const pageHeightPx = pageWidthPx * A4_ASPECT;
    const marginPx = pageWidthPx * MOBILE_MARGIN_RATIO;
    return {
        pageWidthPx,
        pageHeightPx,
        contentWidthPx: pageWidthPx - 2 * marginPx,
        contentHeightPx: pageHeightPx - 2 * marginPx,
        fontSizePx,
        lineHeightPx: fontSizePx * lineHeightRatio,
    };
}

/** 웹 연속 읽기 칼럼 최대 폭(px) — 넓은 화면에서 한 줄이 과하게 길어지지 않게. */
const WEB_MAX_WIDTH_PX = 760;
/** 웹 연속 좌우 여백 비율(폭 대비). */
const WEB_MARGIN_RATIO = 0.06;

/**
 * 웹 출판(031 US3) 연속 페이지 기하(순수) — 페이지 분할 없음.
 * 폭은 가용 폭(읽기 칼럼 최대 760)에 맞춰 reflow, **높이는 Infinity** 라
 * layout(blocks, Infinity) 이 전 줄을 단일 페이지에 누적한다(연속 스크롤). 종이·판형 무관.
 * @param availWidthPx 가용 폭(px)
 * @param fontSizePx 본문 폰트 px
 * @param lineHeightRatio 줄높이 배수(기본 1.8)
 */
export function webPageGeometry(availWidthPx: number, fontSizePx: number, lineHeightRatio = 1.8): PageGeometry {
    const pageWidthPx = Math.min(availWidthPx, WEB_MAX_WIDTH_PX);
    const marginPx = pageWidthPx * WEB_MARGIN_RATIO;
    return {
        pageWidthPx,
        pageHeightPx: Infinity, // 연속 — PageBox 가 내용 높이로 렌더
        contentWidthPx: pageWidthPx - 2 * marginPx,
        contentHeightPx: Infinity, // layout 이 분할 안 함 → 단일 페이지
        fontSizePx,
        lineHeightPx: fontSizePx * lineHeightRatio,
    };
}

/** 용지 라벨(배지·셀렉터용) — 판형은 한글 라벨. */
export function paperLabel(size: PaperSize): string {
    const { widthMm, heightMm } = PAPER_MM[size];
    return `${PAPER_LABEL[size]} · ${widthMm}×${heightMm}mm`;
}

export const PAPER_SIZES: readonly PaperSize[] = ["A5", "A4", "B4", "A3", "A2"] as const;

/** 출판 판형 4종(031) — 셀렉터 노출 순서. */
export const PUBLICATION_FORMAT_SIZES: readonly PublicationFormat[] = ["sinkukpan", "kukpan", "pan46", "mungopan"] as const;

/**
 * 한 페이지 추정 글자수(순수) — SC-002 분량 앵커·원고지 환산 근사용.
 *
 * 한글 글자폭 ≈ 1em(fontSizePx) 가정의 **모델 근사**다. 실제 렌더 글자수는 폰트 실측
 * (measure.ts 의 DOM Range)에 따라 다르며 dogfooding 에서 보정한다(§14 — 단위테스트는 모델만 보장).
 * = floor(본문폭 / 글자폭) × floor(본문높이 / 줄높이).
 */
export function estimateCharsPerPage(geo: PageGeometry): number {
    const charsPerLine = Math.floor(geo.contentWidthPx / geo.fontSizePx);
    const linesPerPage = Math.floor(geo.contentHeightPx / geo.lineHeightPx);
    return Math.max(0, charsPerLine * linesPerPage);
}

// ─────────────────────────────────────────
// blockFont
// ─────────────────────────────────────────

/**
 * heading level 별 fontSizePx 배수 — dogfooding 튜닝 대상.
 * level 1 = 1.8×, level 2 = 1.5×, level 3 = 1.25×.
 */
const HEADING_FONT_MULTIPLIERS: Record<1 | 2 | 3, number> = {
    1: 1.8,
    2: 1.5,
    3: 1.25,
} as const;

/** 본문 줄높이 비율(heading 줄높이 계산에도 재사용). */
const LINE_HEIGHT_RATIO = 1.8;

/**
 * blockAttr 와 base PageGeometry 로부터 블록의 폰트 크기·줄높이(px)를 반환한다(순수).
 *
 * - paragraph: base.fontSizePx / base.lineHeightPx 그대로
 * - heading level 1/2/3: fontSizePx = round(base.fontSizePx × 배수), lineHeightPx = fontSizePx × 1.8
 */
export function blockFont(
    attr: BlockAttr,
    base: PageGeometry,
): { fontSizePx: number; lineHeightPx: number } {
    // heading 만 폰트 배수 적용. paragraph·blockquote·listItem·hr 은 base 그대로.
    if (attr.type !== "heading") {
        return { fontSizePx: base.fontSizePx, lineHeightPx: base.lineHeightPx };
    }
    const multiplier = HEADING_FONT_MULTIPLIERS[attr.level];
    const fontSizePx = Math.round(base.fontSizePx * multiplier);
    const lineHeightPx = fontSizePx * LINE_HEIGHT_RATIO;
    return { fontSizePx, lineHeightPx };
}
