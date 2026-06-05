import type { Memo } from "../../electron/db/types";
import type { InboxMemo } from "../types";
import { formatRelativeDay } from "./relativeDate";

/**
 * 도메인 Memo 를 inbox 표시용 view 로 변환한다.
 * 연결 작품 제목은 메모 도메인에 없으므로 호출부가 projects.list 로 만든 맵을 주입한다.
 */
export function toInboxMemoView(
  memo: Memo,
  projectTitleById: Map<string, string>,
  now: Date,
): InboxMemo {
  return {
    id: memo.id,
    body: memo.body,
    dateLabel: formatRelativeDay(memo.capturedAt, now),
    linkedProjectId: memo.linkedProjectId,
    linkedProjectTitle: memo.linkedProjectId
      ? (projectTitleById.get(memo.linkedProjectId) ?? null)
      : null,
  };
}
