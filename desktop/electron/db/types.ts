// 로컬 persistence 도메인 타입 (설계 §데이터 모델). DB 는 snake_case, 매핑은 각 repository.

export type Project = {
  id: string;
  title: string;
  summary: string;
  tone: string;
  genre: string;
  targetLength: number | null;
  /** 작가가 적는 "다음에 쓸 장면" 한 줄(작품 벽 카드·재진입 한 장의 보조 표시값). 미입력은 빈 문자열. */
  nextScene: string;
  createdAt: string;
  updatedAt: string;
};

export type Document = {
  id: string;
  projectId: string;
  title: string;
  bodyJson: string;
  plainText: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Memo = {
  id: string;
  body: string;
  capturedAt: string;
  source: string;
  /** 연결된 작품 id 목록(다대다). 미연결이면 빈 배열. memo_projects 조인으로 채워지는 읽기용 집계. */
  linkedProjectIds: string[];
  createdAt: string;
  updatedAt: string;
  /** soft delete 표식. null = 미삭제, ISO = 삭제 시각. list() 에서 제외된다. */
  deletedAt: string | null;
};

/** 특정 작품 맥락의 메모 — 그 작품에서의 곁쪽지 고정 여부 포함(listByProject 반환용). */
export type ProjectMemo = Memo & { pinned: boolean };

/** 작품 벽 카드용 집계 — 작품(nextScene 포함) + 그 본문 plainText(마지막 문장 파생 소스). */
export type ProjectCard = Project & { lastSentenceSource: string };
