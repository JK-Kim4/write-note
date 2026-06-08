import type { DatabaseSync } from "node:sqlite";
import type { WorkSession } from "./types";

/** 30초 미만 세션은 폐기(자동 종료 경로). 명시 종료(endSessionWithLog)는 이 경계를 타지 않는다. */
export const MIN_SESSION_MS = 30_000;

type WorkSessionRow = {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
};

export class WorkSessionRepository {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * 그 작품의 집필 세션을 시작한다.
   * 이미 열린 세션이 있으면 먼저 endOpen 으로 닫고(30s 폐기 포함), 새 행을 생성한다.
   * 작품당 열린 세션 1개 보장.
   */
  start(projectId: string): WorkSession {
    // 기존 열린 세션이 있으면 먼저 닫는다
    const now = new Date().toISOString();
    this.endOpen(projectId, now);

    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, NULL)",
      )
      .run(id, projectId, startedAt);

    return { id, projectId, startedAt, endedAt: null };
  }

  /**
   * 그 작품의 열린 세션을 종료한다(자동 종료 경로).
   * duration < MIN_SESSION_MS 이면 행 삭제(30초 폐기).
   * 열린 세션이 없으면 graceful no-op.
   */
  endOpen(projectId: string, endedAt: string): void {
    const row = this.db
      .prepare(
        "SELECT * FROM work_sessions WHERE project_id = ? AND ended_at IS NULL LIMIT 1",
      )
      .get(projectId) as WorkSessionRow | undefined;

    if (!row) return;

    const durationMs =
      new Date(endedAt).getTime() - new Date(row.started_at).getTime();

    if (durationMs < MIN_SESSION_MS) {
      this.db.prepare("DELETE FROM work_sessions WHERE id = ?").run(row.id);
    } else {
      this.db
        .prepare("UPDATE work_sessions SET ended_at = ? WHERE id = ?")
        .run(endedAt, row.id);
    }
  }

  /**
   * 모든 작품의 열린 세션을 일괄 종료한다(앱 before-quit).
   * 각 세션에 30초 폐기 동일 적용.
   */
  endAllOpenSessions(endedAt: string): void {
    const rows = this.db
      .prepare("SELECT * FROM work_sessions WHERE ended_at IS NULL")
      .all() as WorkSessionRow[];

    const endTs = new Date(endedAt).getTime();
    for (const row of rows) {
      const durationMs = endTs - new Date(row.started_at).getTime();
      if (durationMs < MIN_SESSION_MS) {
        this.db.prepare("DELETE FROM work_sessions WHERE id = ?").run(row.id);
      } else {
        this.db
          .prepare("UPDATE work_sessions SET ended_at = ? WHERE id = ?")
          .run(endedAt, row.id);
      }
    }
  }

  /**
   * 앱 시작 시 비정상 종료로 남은 열린 세션을 폐기한다(DELETE).
   * 과대 합산 방지용 — started_at 기준 의미 없는 세션이므로 통째로 삭제.
   */
  closeDangling(): void {
    this.db.prepare("DELETE FROM work_sessions WHERE ended_at IS NULL").run();
  }

  /**
   * 그 작품의 종료된 세션 합산 시간(ms).
   * 진행 중(NULL) 세션은 제외한다. ISO 문자열 → Date 파싱으로 차이 계산.
   */
  totalDurationMsByProject(projectId: string): number {
    const rows = this.db
      .prepare(
        "SELECT started_at, ended_at FROM work_sessions WHERE project_id = ? AND ended_at IS NOT NULL",
      )
      .all(projectId) as Array<{ started_at: string; ended_at: string }>;

    return rows.reduce((sum, r) => {
      return sum + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime());
    }, 0);
  }
}
