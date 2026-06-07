/**
 * 페이지 분할 — 파생 계산(순수).
 *
 * 분할/렌더는 브라우저(CSS column-wrap)가 하지만, "몇 장인가"는 순수 계산이다. 기하는 줄 높이의
 * 정수배(본문 26줄 + 패딩 1+1줄 = 종이 28줄, 책상 간격 2줄 → 보폭 30줄)로 고정돼, 측정 높이만으로
 * 장수를 낸다. 저장은 안 한다(렌더 시점 파생). 쪽번호 위치는 Task 4 에서 추가.
 */

/** 본문 줄 높이(px) — CSS line-height(18px*1.92)와 일치. */
export const LINE_PX = 18 * 1.92;
/**
 * 한 장 보폭(px, 줌 1 기준) = 종이 박스(28줄) + 책상 간격(2줄) = 30줄.
 * 종이 박스 = 본문 26줄 + 위/아래 패딩 1줄씩. CSS --page-stride 와 일치.
 */
export const PAGE_STRIDE_PX = LINE_PX * 30;
/** 종이 박스(.sheet) 높이(px) = 본문 26줄 + 위/아래 패딩 1줄씩 = 28줄. */
export const SHEET_H_PX = LINE_PX * 28;

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

const PAGE_TEXT_LINES = 26; // 한 장 본문 줄 수
const STRIDE_LINES = 30; // 보폭(줄) = 종이 28 + 책상 2

/**
 * 본문 flow 상단에서 줄 단위 거리(linesFromTop)가 가리키는 전역 줄 번호(0-base).
 * 페이지마다 본문 26줄 + 간격 4줄(보폭 30)이라, 간격 구간 클릭은 그 장의 마지막 줄로 스냅한다.
 * 노트처럼 "빈 줄 클릭 → 그 줄로 커서" 에서 목표 줄을 계산하는 데 쓴다.
 */
export function globalLineAt(linesFromTop: number): number {
  if (linesFromTop <= 0) return 0;
  const page = Math.floor(linesFromTop / STRIDE_LINES);
  const within = linesFromTop - page * STRIDE_LINES;
  const row = Math.min(PAGE_TEXT_LINES - 1, Math.floor(within));
  return page * PAGE_TEXT_LINES + row;
}
