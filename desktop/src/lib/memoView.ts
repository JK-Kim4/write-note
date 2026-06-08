import type { Memo } from "../../electron/db/types";
import type { InboxMemo, LinkedProject } from "../types";
import { formatRelativeDay } from "./relativeDate";

/**
 * 도메인 Memo 를 inbox 표시용 view 로 변환한다.
 * 연결 작품 제목은 메모 도메인에 없으므로 호출부가 projects.list 로 만든 맵을 주입한다.
 * 맵에 없는(사라진) 작품 id 는 제외한다.
 */
export function toInboxMemoView(
  memo: Memo,
  projectTitleById: Map<string, string>,
  now: Date,
): InboxMemo {
  const linkedProjects: LinkedProject[] = memo.linkedProjectIds
    .map((id) => {
      const title = projectTitleById.get(id);
      return title === undefined ? null : { id, title };
    })
    .filter((p): p is LinkedProject => p !== null);

  return {
    id: memo.id,
    body: memo.body,
    dateLabel: formatRelativeDay(memo.capturedAt, now),
    linkedProjects,
  };
}
