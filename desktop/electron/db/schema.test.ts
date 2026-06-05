// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./schema";

type ColumnInfo = { name: string };

describe("migrate", () => {
  it("should_create_projects_with_genre_column_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const cols = db.prepare("PRAGMA table_info(projects)").all() as ColumnInfo[];
    expect(cols.some((c) => c.name === "genre")).toBe(true);
  });

  it("should_add_genre_column_to_legacy_v1_db_keeping_existing_rows", () => {
    const db = new DatabaseSync(":memory:");
    // v1 스키마(genre 없음)를 수동 재현 — 기존 사용자 .db 상황.
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT '', target_length INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 1;
    `);
    db.prepare("INSERT INTO projects (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "x",
      "옛 작품",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    migrate(db);

    const cols = db.prepare("PRAGMA table_info(projects)").all() as ColumnInfo[];
    expect(cols.some((c) => c.name === "genre")).toBe(true);
    const row = db.prepare("SELECT title, genre FROM projects WHERE id = ?").get("x") as {
      title: string;
      genre: string;
    };
    expect(row.title).toBe("옛 작품");
    expect(row.genre).toBe("");
  });

  it("should_create_memos_with_deleted_at_column_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const cols = db.prepare("PRAGMA table_info(memos)").all() as ColumnInfo[];
    expect(cols.some((c) => c.name === "deleted_at")).toBe(true);
  });

  it("should_add_deleted_at_column_to_legacy_v2_db_keeping_existing_memos", () => {
    const db = new DatabaseSync(":memory:");
    // v2 스키마(memos 에 deleted_at 없음)를 수동 재현 — 기존 사용자 .db 상황.
    db.exec(`
      CREATE TABLE memos (
        id TEXT PRIMARY KEY, body TEXT NOT NULL, captured_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'app', linked_project_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 2;
    `);
    db.prepare(
      "INSERT INTO memos (id, body, captured_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m", "옛 메모", "2026-01-01T00:00:00.000Z", "app", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

    migrate(db);

    const cols = db.prepare("PRAGMA table_info(memos)").all() as ColumnInfo[];
    expect(cols.some((c) => c.name === "deleted_at")).toBe(true);
    const row = db.prepare("SELECT body, deleted_at FROM memos WHERE id = ?").get("m") as {
      body: string;
      deleted_at: string | null;
    };
    expect(row.body).toBe("옛 메모");
    expect(row.deleted_at).toBeNull();
  });
});
