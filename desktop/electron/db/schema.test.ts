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
});
