/**
 * 댓글 앵커(046) → 사람이 읽는 위치 라벨. 순수 함수.
 *
 * 앵커는 0-base(블록 인덱스·문단 내 시작 오프셋)이지만 사람에게는 1-base 로 보여준다.
 * 공유본(불변 스냅샷) 기준이라 위치 표시는 그 공유본이 유지되는 동안 항상 유효(FR-022).
 */
export function formatCommentAnchor(blockIndex: number, start: number, length: number): string {
    return `${blockIndex + 1}번째 문단 · ${start + 1}번째 글자부터 ${length}자`;
}
