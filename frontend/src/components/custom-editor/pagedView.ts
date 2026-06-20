/**
 * 페이지 넘김 뷰(029) 순수 헬퍼 — currentPage 클램프·이동·캐럿 동기 판정.
 * 시계/DOM 비의존. CustomEditor 의 페이지 전환 결정 로직을 테스트 가능하게 분리.
 */

/** 페이지 인덱스를 [0, total-1] 로 가둔다. total<=0 이면 0. */
export function clampPage(index: number, total: number): number {
    if (total <= 0 || index < 0) return 0;
    return index > total - 1 ? total - 1 : index;
}

/** 다음 페이지(끝에서 더 안 감). */
export function nextPage(current: number, total: number): number {
    return clampPage(current + 1, total);
}

/** 이전 페이지(처음에서 더 안 감). */
export function prevPage(current: number, total: number): number {
    return clampPage(current - 1, total);
}

/** 캐럿이 보이는 페이지와 다르면 따라갈 페이지 인덱스, 같으면 null(전환 불필요). */
export function pageToFollowCaret(caretPageIndex: number, current: number): number | null {
    return caretPageIndex === current ? null : caretPageIndex;
}
