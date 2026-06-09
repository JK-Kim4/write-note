/**
 * 도메인 메모 → 책상/서랍 표시용 InboxMemo 변환(015 US2). desktop `src/lib/memoView.ts` 이식.
 *
 * web 차이: 연결 작품 제목이 MemoResponse.projects 에 이미 담겨 shim(Memo.linkedProjects)이 채워주므로
 * desktop 처럼 projects.list 로 만든 title 맵을 주입할 필요가 없다.
 */
import type { InboxMemo, Memo, ProjectMemo } from "@/lib/types/domain";
import { formatRelativeDay } from "@/lib/relativeDate";

/** 전역 메모(책상) → InboxMemo. 연결 작품 칩 포함. */
export function toInboxMemoView(memo: Memo, now: Date): InboxMemo {
    return {
        id: memo.id,
        body: memo.body,
        dateLabel: formatRelativeDay(memo.capturedAt, now),
        linkedProjects: memo.linkedProjects,
    };
}

/** 작품 맥락 메모(서랍) → InboxMemo. 고정 여부 포함, 칩 없음. */
export function toDrawerMemoView(memo: ProjectMemo, now: Date): InboxMemo {
    return {
        id: memo.id,
        body: memo.body,
        dateLabel: formatRelativeDay(memo.capturedAt, now),
        linkedProjects: [],
        pinned: memo.pinned,
    };
}
