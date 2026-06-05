import type { DatabaseSync } from "node:sqlite";
import type { Memo } from "./types";

type MemoRow = {
  id: string;
  body: string;
  captured_at: string;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toMemo(r: MemoRow, linkedProjectIds: string[]): Memo {
  return {
    id: r.id,
    body: r.body,
    capturedAt: r.captured_at,
    source: r.source,
    linkedProjectIds,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export type CreateMemoInput = {
  body: string;
  source?: string;
  capturedAt?: string;
};

export class MemoRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateMemoInput): Memo {
    const now = new Date().toISOString();
    const row: MemoRow = {
      id: crypto.randomUUID(),
      body: input.body,
      captured_at: input.capturedAt ?? now,
      source: input.source ?? "app",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    this.db
      .prepare(
        "INSERT INTO memos (id, body, captured_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(row.id, row.body, row.captured_at, row.source, row.created_at, row.updated_at);
    return toMemo(row, []);
  }

  getById(id: string): Memo | null {
    const row = this.db.prepare("SELECT * FROM memos WHERE id = ?").get(id) as MemoRow | undefined;
    return row ? toMemo(row, this.linkedIdsFor(id)) : null;
  }

  /** soft delete 제외 메모를 captured_at DESC 로, 각 메모에 연결 작품 id 를 채워 반환. */
  list(): Memo[] {
    const rows = this.db
      .prepare("SELECT * FROM memos WHERE deleted_at IS NULL ORDER BY captured_at DESC")
      .all() as MemoRow[];
    const byMemo = this.linksByMemo();
    return rows.map((r) => toMemo(r, byMemo.get(r.id) ?? []));
  }

  /** 특정 작품에 연결된(soft delete 제외) 메모만 captured_at DESC 로 반환(집필 패널용). */
  listByProject(projectId: string): Memo[] {
    const rows = this.db
      .prepare(
        `SELECT m.* FROM memos m
         JOIN memo_projects mp ON mp.memo_id = m.id
         WHERE mp.project_id = ? AND m.deleted_at IS NULL
         ORDER BY m.captured_at DESC`,
      )
      .all(projectId) as MemoRow[];
    const byMemo = this.linksByMemo();
    return rows.map((r) => toMemo(r, byMemo.get(r.id) ?? []));
  }

  /** 메모-작품 연결 추가. 같은 쌍 재호출은 무시(멱등). */
  addLink(memoId: string, projectId: string): void {
    this.db
      .prepare("INSERT OR IGNORE INTO memo_projects (memo_id, project_id, created_at) VALUES (?, ?, ?)")
      .run(memoId, projectId, new Date().toISOString());
  }

  /** 메모-작품 연결 해제. */
  removeLink(memoId: string, projectId: string): void {
    this.db.prepare("DELETE FROM memo_projects WHERE memo_id = ? AND project_id = ?").run(memoId, projectId);
  }

  /** soft delete — deleted_at 에 현재 시각을 기록한다. 영향 행이 있으면 true. */
  softDelete(id: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare("UPDATE memos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
      .run(now, now, id);
    return result.changes > 0;
  }

  /** soft delete 된 메모를 복원한다(deleted_at = NULL). 연결 행은 보존되므로 복원 시 연결 복귀. */
  restore(id: string): Memo | null {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE memos SET deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    return this.getById(id);
  }

  private linkedIdsFor(memoId: string): string[] {
    const rows = this.db
      .prepare("SELECT project_id FROM memo_projects WHERE memo_id = ?")
      .all(memoId) as Array<{ project_id: string }>;
    return rows.map((r) => r.project_id);
  }

  private linksByMemo(): Map<string, string[]> {
    const rows = this.db
      .prepare("SELECT memo_id, project_id FROM memo_projects")
      .all() as Array<{ memo_id: string; project_id: string }>;
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const list = map.get(r.memo_id) ?? [];
      list.push(r.project_id);
      map.set(r.memo_id, list);
    }
    return map;
  }
}
