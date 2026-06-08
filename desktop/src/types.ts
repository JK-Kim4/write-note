export type Theme = "light" | "dark";
export type SaveState = "saved" | "saving" | "error" | "unsaved";

/** 에디터 본문 변경 페이로드 — 로컬 document 저장(documents.update)에 그대로 전달한다. */
export type DocumentChange = { bodyJson: string; plainText: string; wordCount: number };
export type Screen = "projects" | "write" | "memo" | "log" | "contact";

/** 메모에 연결된 작품(제목 포함). inbox 칩·집필 패널 표시용. */
export type LinkedProject = { id: string; title: string };

export type InboxMemo = {
  id: string;
  body: string;
  /** capturedAt → "오늘/어제/N일 전/N주 전" 상대 라벨 */
  dateLabel: string;
  /** 연결된 작품 목록(제목 붙음, 다대다). 미연결이면 빈 배열. 사라진 작품 id 는 제외됨 */
  linkedProjects: LinkedProject[];
  /** 현재 작품 맥락에서의 곁쪽지 고정 여부(집필 패널 전용). inbox view 에선 undefined. */
  pinned?: boolean;
};
