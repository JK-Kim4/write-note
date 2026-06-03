import type { DatabaseSync } from "node:sqlite";
import type { Memo } from "./types";

type MemoRow = {
  id: string;
  body: string;
  captured_at: string;
  source: string;
  linked_project_id: string | null;
  created_at: string;
  updated_at: string;
};

function toMemo(r: MemoRow): Memo {
  return {
    id: r.id,
    body: r.body,
    capturedAt: r.captured_at,
    source: r.source,
    linkedProjectId: r.linked_project_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type CreateMemoInput = {
  body: string;
  source?: string;
  linkedProjectId?: string | null;
  capturedAt?: string;
};

export class MemoRepository {
  constructor(private readonly db: DatabaseSync) {}

  create(input: CreateMemoInput): Memo {
    const now = new Date().toISOString();
    const memo: Memo = {
      id: crypto.randomUUID(),
      body: input.body,
      capturedAt: input.capturedAt ?? now,
      source: input.source ?? "app",
      linkedProjectId: input.linkedProjectId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO memos (id, body, captured_at, source, linked_project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        memo.id,
        memo.body,
        memo.capturedAt,
        memo.source,
        memo.linkedProjectId,
        memo.createdAt,
        memo.updatedAt,
      );
    return memo;
  }

  getById(id: string): Memo | null {
    const row = this.db.prepare("SELECT * FROM memos WHERE id = ?").get(id) as MemoRow | undefined;
    return row ? toMemo(row) : null;
  }

  list(): Memo[] {
    const rows = this.db.prepare("SELECT * FROM memos ORDER BY captured_at DESC").all() as MemoRow[];
    return rows.map(toMemo);
  }

  link(id: string, projectId: string | null): Memo | null {
    const current = this.getById(id);
    if (!current) return null;
    const updatedAt = new Date().toISOString();
    this.db
      .prepare("UPDATE memos SET linked_project_id = ?, updated_at = ? WHERE id = ?")
      .run(projectId, updatedAt, id);
    return { ...current, linkedProjectId: projectId, updatedAt };
  }
}
