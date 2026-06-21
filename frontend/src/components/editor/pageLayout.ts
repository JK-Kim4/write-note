/**
 * 페이지 분할 — 파생 계산(순수). desktop `src/components/pageLayout.ts` 이식(015 T001).
 *
 * Phase 2: A4 하드코딩 → PaperGeometry 파라미터화. A4 는 현 상수와 수치 완전 동일(회귀 0).
 * 분할/렌더는 브라우저(CSS column-wrap)가 하지만, "몇 장인가"는 순수 계산이다.
 */

/**
 * 본문 줄 높이(px) — CSS line-height 와 일치. 용지 무관, 불변. **정수여야 한다.**
 *
 * 비정수(과거 18*1.92=34.56)면 브라우저가 줄박스를 device-pixel 로 스냅하며 키워, multicol
 * column-height(=N*LINE_PX)에 N 줄이 안 들어간다(예: 26→24). 단, 정수만으로는 부족하다 —
 * CSS `orphans`/`widows` 기본값(2)이 문단의 마지막 1~2줄을 다음 장으로 통째 밀어내므로
 * .ProseMirror 에 `orphans:1; widows:1` 도 함께 둔다(paper-editor.css/b.css). 둘이 합쳐져야
 * "페이지가 26줄 꽉 참 + 문단이 줄 단위로 갈림(통째 점프 없음)"이 성립한다.
 * CSS(`--page-line`/`--b-page-line`)와 반드시 같은 정수값.
 */
export const LINE_PX = 35;

/** 지원 용지 크기 식별자. ISO 4종 + 출판 판형 4종(031). */
export type PaperSize = "A4" | "A3" | "A2" | "B4" | "sinkukpan" | "kukpan" | "pan46" | "mungopan";

/** 셀렉터 노출 순서(031) — ISO 4종 → 출판 판형 4종. */
export const PAPER_SIZE_ORDER: readonly PaperSize[] = ["A4", "A3", "A2", "B4", "sinkukpan", "kukpan", "pan46", "mungopan"] as const;

/** 용지별 기하 파생값 (순수, paperGeometry() 로 생성). */
export type PaperGeometry = {
    bodyLines: number; // 본문 줄 수 (A4: 26)
    sheetLines: number; // 종이 박스 줄 수 = bodyLines + 2 (A4: 28)
    strideLines: number; // 보폭 줄 수 = bodyLines + 4 (A4: 30)
    pageHpx: number; // 본문 높이(px) = bodyLines * LINE_PX
    sheetHpx: number; // 종이 박스 높이(px) = sheetLines * LINE_PX
    stridePx: number; // 보폭(px) = strideLines * LINE_PX
    colWidthMm: number; // 본문 열 너비(mm) = widthMm - 50 (좌우 25mm 여백)
    maxWidthMm: number; // 최대 너비(mm) = widthMm
};

/**
 * 용지 프리셋 — portrait, stylized 줄수 모델.
 * A4 기하는 metric 정확이 아니라 줄수 정수 모델(sheet = 28줄 ≈ 256mm ≠ 297mm).
 * 나머지 용지는 A4 height 비율로 bodyLines 를 스케일(round) 한다.
 */
export const PAPER_PRESETS: Record<PaperSize, { widthMm: number; heightMm: number; bodyLines: number }> = {
    A4: { widthMm: 210, heightMm: 297, bodyLines: 26 },
    B4: { widthMm: 257, heightMm: 364, bodyLines: 32 }, // JIS B4 (257×364mm). 26×(364/297)=31.9→32
    A3: { widthMm: 297, heightMm: 420, bodyLines: 37 }, // 26×(420/297)=36.8→37
    A2: { widthMm: 420, heightMm: 594, bodyLines: 52 }, // 26×(594/297)=52.0
    // 출판 판형(031) — 재단 mm. bodyLines 는 레거시 모델용(자체 에디터는 geometry.ts 사용), height 비율 스케일.
    sinkukpan: { widthMm: 152, heightMm: 225, bodyLines: 20 },
    kukpan: { widthMm: 148, heightMm: 210, bodyLines: 18 },
    pan46: { widthMm: 128, heightMm: 188, bodyLines: 16 },
    mungopan: { widthMm: 105, heightMm: 148, bodyLines: 13 },
};

/**
 * 용지 크기 식별자로부터 기하 파생값을 계산한다(순수함수).
 * A4 산출값은 Phase 1 이전 상수(SHEET_H_PX=28*LINE, PAGE_STRIDE_PX=30*LINE)와 완전 일치.
 */
export function paperGeometry(size: PaperSize): PaperGeometry {
    const { widthMm, bodyLines } = PAPER_PRESETS[size];
    const sheetLines = bodyLines + 2;
    const strideLines = bodyLines + 4;
    return {
        bodyLines,
        sheetLines,
        strideLines,
        pageHpx: bodyLines * LINE_PX,
        sheetHpx: sheetLines * LINE_PX,
        stridePx: strideLines * LINE_PX,
        colWidthMm: widthMm - 50,
        maxWidthMm: widthMm,
    };
}

// ── A4 편의 상수 (하위 호환 — 호출부를 paperGeometry("A4")로 갱신 완료 후 제거 가능) ────────────────
/** @deprecated paperGeometry("A4").stridePx 사용 권장. A4 하드코딩 편의 상수. */
export const PAGE_STRIDE_PX = LINE_PX * 30;
/** @deprecated paperGeometry("A4").sheetHpx 사용 권장. A4 하드코딩 편의 상수. */
export const SHEET_H_PX = LINE_PX * 28;

/**
 * 본문 flow 의 측정 높이(px, 줌 반영됨)와 현재 줌·보폭(px)으로 장수를 계산한다.
 * 측정값은 stride*zoom 단위로 늘어나므로 그 단위로 나눠 줌을 상쇄한다.
 *
 * @param flowHeightPx - .ProseMirror getBoundingClientRect().height
 * @param zoom         - 현재 CSS zoom 값
 * @param stridePx     - 장 보폭(px) — paperGeometry(size).stridePx
 */
export function pageCount(flowHeightPx: number, zoom: number, stridePx: number): number {
    const stride = stridePx * zoom;
    if (stride <= 0) return 1;
    // 측정 높이 ≈ (N-1)*보폭 + 마지막 장 높이. 마지막 장이 꽉 안 차도 그 장을 1장으로 센다.
    return Math.max(1, Math.floor(flowHeightPx / stride - 0.001) + 1);
}

/**
 * 본문 flow 상단에서 줄 단위 거리(linesFromTop)가 가리키는 전역 줄 번호(0-base).
 * 간격 구간 클릭은 그 장의 마지막 줄로 스냅한다.
 *
 * @param linesFromTop - (clientY - pmTop) / lineUnit
 * @param bodyLines    - 장당 본문 줄 수 — paperGeometry(size).bodyLines
 * @param strideLines  - 보폭(줄) — paperGeometry(size).strideLines
 */
export function globalLineAt(linesFromTop: number, bodyLines: number, strideLines: number): number {
    if (linesFromTop <= 0) return 0;
    const page = Math.floor(linesFromTop / strideLines);
    const within = linesFromTop - page * strideLines;
    const row = Math.min(bodyLines - 1, Math.floor(within));
    return page * bodyLines + row;
}

/**
 * 장별 쪽번호의 top 위치(px, .paper 상단 기준). 각 장 하단 패딩 줄(본문 아래).
 * = 보폭*k + 종이높이 − 0.5줄. CSS zoom 이 비례 적용되어 줌과 무관하게 제자리.
 *
 * @param count    - 총 장수
 * @param stridePx - 장 보폭(px) — paperGeometry(size).stridePx
 * @param sheetHpx - 종이 박스 높이(px) — paperGeometry(size).sheetHpx
 */
export function pageNumberTopsPx(count: number, stridePx: number, sheetHpx: number): number[] {
    return Array.from({ length: count }, (_, i) => i * stridePx + sheetHpx - LINE_PX * 0.5);
}
