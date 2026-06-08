/** 한 블록 앞에서 다음 장으로 넘긴다는 표시 + 그때 끼울 여백 높이(px). */
export type PageBreak = {
  /** 이 인덱스의 top-level 블록 '앞'에 여백을 끼워 다음 장 맨 위로 민다. */
  beforeIndex: number;
  /** 끼울 여백 = (현재 페이지 남은 높이) + (장 사이 책상색 간격 gap). */
  spacerPx: number;
};

/**
 * 블록(문단·제목 등 top-level 블록) 통째 분할.
 *
 * 각 블록의 실제 높이(px)와 한 페이지 본문 높이(px)를 받아, 어떤 블록 앞에서 다음 장으로
 * 넘겨야 하는지 계산한다. 블록 '중간'을 자르지 않으므로(워드·한글식 문단 단위 이동)
 * 한글 음절이나 IME 조합이 절대 쪼개지지 않는다.
 *
 * 픽셀 절대 위치가 아니라 블록별 높이만으로 시뮬레이션하므로, 여백(spacer) 위젯이
 * 끼어든 뒤 측정값이 흔들리는 문제를 피한다(측정은 블록 intrinsic 높이로만).
 */
export function computePageBreaks(
  blockHeights: readonly number[],
  pageHeight: number,
  gap: number,
): PageBreak[] {
  const breaks: PageBreak[] = [];
  let used = 0;
  for (let i = 0; i < blockHeights.length; i++) {
    const h = blockHeights[i];
    if (used > 0 && used + h > pageHeight) {
      // 현재 페이지에 안 들어감 → 남은 높이 + gap 만큼 여백을 끼워 다음 장 맨 위로.
      breaks.push({ beforeIndex: i, spacerPx: pageHeight - used + gap });
      used = h;
    } else {
      used += h;
    }
    // 한 블록이 페이지보다 큰 예외 — 그 장을 채운 것으로 보고 다음 블록은 새 장으로.
    if (used > pageHeight) used = pageHeight;
  }
  return breaks;
}
