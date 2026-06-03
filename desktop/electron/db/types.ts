// 로컬 persistence 도메인 타입 (설계 §데이터 모델). DB 는 snake_case, 매핑은 각 repository.

export type Project = {
  id: string;
  title: string;
  summary: string;
  tone: string;
  genre: string;
  targetLength: number | null;
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
  linkedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};
