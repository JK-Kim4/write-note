import type { DatabaseSync } from "node:sqlite";
import type { ProjectLog } from "./types";

type ProjectLogRow = {
  id: string;
  project_id: string;
  body: string;
  created_at: string;
};

function toProjectLog(r: ProjectLogRow): ProjectLog {
  return {
    id: r.id,
    projectId: r.project_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

export class ProjectLogRepository {
  constructor(private readonly db: DatabaseSync) {}

  /** 기록 메모 생성 — created_at 은 main 시계 ISO, id 는 randomUUID. */
  create(projectId: string, body: string): ProjectLog {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    this.db
      .prepare("INSERT INTO project_logs (id, project_id, body, created_at) VALUES (?, ?, ?, ?)")
      .run(id, projectId, body, now);
    return { id, projectId, body, createdAt: now };
  }

  /** 그 작품의 기록 메모 전체 — created_at DESC(아코디언 최신순). */
  listByProject(projectId: string): ProjectLog[] {
    const rows = this.db
      .prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as ProjectLogRow[];
    return rows.map(toProjectLog);
  }

  /** 그 작품의 최신 기록 메모 1개(카드 집계용). 없으면 null. */
  latestByProject(projectId: string): ProjectLog | null {
    const row = this.db
      .prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(projectId) as ProjectLogRow | undefined;
    return row ? toProjectLog(row) : null;
  }
}
