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
  /** 연결된 작품 id 목록(다대다). 미연결이면 빈 배열. memo_projects 조인으로 채워지는 읽기용 집계. */
  linkedProjectIds: string[];
  createdAt: string;
  updatedAt: string;
  /** soft delete 표식. null = 미삭제, ISO = 삭제 시각. list() 에서 제외된다. */
  deletedAt: string | null;
};
