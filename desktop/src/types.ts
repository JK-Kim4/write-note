export type Theme = "light" | "dark";
export type SaveState = "saved" | "saving" | "error" | "unsaved";

/** 에디터 본문 변경 페이로드 — 로컬 document 저장(documents.update)에 그대로 전달한다. */
export type DocumentChange = { bodyJson: string; plainText: string; wordCount: number };
export type MemoState = "loaded" | "empty" | "loading";
export type Screen = "projects" | "write" | "memo" | "log";

export type InboxMemo = {
  id: string;
  body: string;
  /** capturedAt → "오늘/어제/N일 전/N주 전" 상대 라벨 */
  dateLabel: string;
  linkedProjectId: string | null;
  /** 연결된 작품 제목. 미연결이거나 작품이 사라졌으면 null */
  linkedProjectTitle: string | null;
};

export type Memo = {
  id: string;
  body: string;
  date: string;
  tag: string;
};
