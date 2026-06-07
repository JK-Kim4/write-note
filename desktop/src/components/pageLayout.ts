/**
 * 페이지 분할 — 파생 계산(순수).
 *
 * 분할/렌더는 브라우저(CSS column-wrap)가 하지만, "몇 장인가 / 각 쪽번호를 어느 위치에 둘까"는
 * 순수 계산이다. 페이지 높이·간격은 줄 높이(1.92em)의 정수배(한 장 26줄 + 간격 3줄 = 보폭 29줄)로
 * 고정돼 있어, 측정 높이만으로 장수를 낸다. 저장은 안 한다(렌더 시점 파생).
 */

/** 본문 줄 높이(px) — CSS line-height(18px*1.92)와 일치. */
export const LINE_PX = 18 * 1.92;
/** 한 장(26줄) + 간격(3줄) = 다음 장까지 보폭(px, 줌 1 기준). CSS --page-stride 와 일치. */
export const PAGE_STRIDE_PX = LINE_PX * 29;

const PAGE_LINES = 26;
const STRIDE_LINES = 29;
/** 쪽번호 baseline 을 각 장 마지막 줄 살짝 아래로. */
const NUMBER_FROM_PAGE_TOP_LINES = PAGE_LINES - 1.2;
const LINE_EM = 1.92;

/**
 * 본문 flow 의 측정 높이(px, 줌 반영됨)와 현재 줌으로 장수를 계산한다.
 * 측정값은 stride*zoom 단위로 늘어나므로 그 단위로 나눠 줌을 상쇄한다.
 */
export function pageCount(flowHeightPx: number, zoom: number): number {
  const stride = PAGE_STRIDE_PX * zoom;
  if (stride <= 0) return 1;
  // 측정 높이 ≈ (N-1)*보폭 + 마지막 장 높이. 마지막 장이 꽉 안 차도 그 장을 1장으로 센다.
  // → round 가 아니라 floor+1 (round 는 마지막 장이 절반 미만이면 장수를 적게 셈).
  return Math.max(1, Math.floor(flowHeightPx / stride - 0.001) + 1);
}

/** 장별 쪽번호의 top 위치(em, 본문 flow 상단 기준). 줌 무관 상대값. */
export function pageNumberTopsEm(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    (NUMBER_FROM_PAGE_TOP_LINES + i * STRIDE_LINES) * LINE_EM,
  );
}
