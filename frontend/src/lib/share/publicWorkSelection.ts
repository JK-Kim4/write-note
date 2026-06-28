/**
 * 시리즈 공개 작품 선택 헬퍼(047/ISSUE-055 M1) — 공개 해제(deselect) 판정.
 *
 * 공개에서 빠지는 작품은 setPublicWorks 시 스냅샷이 삭제되고, 그 스냅샷에 달린 받은 피드백(댓글)도
 * DB FK CASCADE 로 함께 영구 삭제된다(backend ShareService.setPublicWorks + V28 fk_share_comment_snapshot).
 * 그래서 deselect 가 있으면 저장 전 사용자에게 경고 확인을 받는다(무경고 데이터 손실 방지).
 */

/** 현재 공개(current) 작품 중 새 선택(selected)에서 빠진 작품 id — 공개 해제 → 받은 피드백 동반 삭제 대상(원래 순서 보존). */
export function removedWorkIds(current: ReadonlyArray<number>, selected: ReadonlySet<number>): number[] {
    return current.filter((id) => !selected.has(id));
}
