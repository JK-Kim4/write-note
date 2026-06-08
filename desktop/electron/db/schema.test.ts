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

  it("should_create_memo_projects_and_drop_linked_project_id_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.some((t) => t.name === "memo_projects")).toBe(true);
    const memoCols = db.prepare("PRAGMA table_info(memos)").all() as ColumnInfo[];
    expect(memoCols.some((c) => c.name === "linked_project_id")).toBe(false);
    const cols = db.prepare("PRAGMA table_info(memo_projects)").all() as ColumnInfo[];
    expect(cols.map((c) => c.name).sort()).toEqual(["created_at", "memo_id", "pinned", "project_id"]);
  });

  it("should_migrate_legacy_v3_single_link_into_memo_projects_and_drop_column", () => {
    const db = new DatabaseSync(":memory:");
    // v3 스키마(memos.linked_project_id 단일 연결 + deleted_at) 재현 — 기존 사용자 .db.
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT '', genre TEXT NOT NULL DEFAULT '', target_length INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE memos (
        id TEXT PRIMARY KEY, body TEXT NOT NULL, captured_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'app',
        linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      ) STRICT;
      PRAGMA user_version = 3;
    `);
    db.prepare("INSERT INTO projects (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "p1",
      "옛 작품",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );
    db.prepare(
      "INSERT INTO memos (id, body, captured_at, source, linked_project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("m1", "연결 메모", "2026-01-02T00:00:00.000Z", "app", "p1", "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    db.prepare(
      "INSERT INTO memos (id, body, captured_at, source, linked_project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("m2", "미연결 메모", "2026-01-02T00:00:00.000Z", "app", null, "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z");

    migrate(db);

    // 단일 연결이 연결 행으로 보존 이관(SC-006)
    const links = db.prepare("SELECT memo_id, project_id FROM memo_projects").all() as {
      memo_id: string;
      project_id: string;
    }[];
    expect(links).toEqual([{ memo_id: "m1", project_id: "p1" }]);
    // 컬럼 제거 + 버전 상승
    const memoCols = db.prepare("PRAGMA table_info(memos)").all() as ColumnInfo[];
    expect(memoCols.some((c) => c.name === "linked_project_id")).toBe(false);
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(6);
    // 메모 본문 보존
    expect((db.prepare("SELECT body FROM memos WHERE id='m1'").get() as { body: string }).body).toBe("연결 메모");
  });

  it("should_create_next_scene_and_pinned_columns_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const pcols = db.prepare("PRAGMA table_info(projects)").all() as ColumnInfo[];
    expect(pcols.some((c) => c.name === "next_scene")).toBe(true);
    const mpcols = db.prepare("PRAGMA table_info(memo_projects)").all() as ColumnInfo[];
    expect(mpcols.some((c) => c.name === "pinned")).toBe(true);
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(6);
  });

  it("should_create_project_logs_and_work_sessions_tables_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.some((t) => t.name === "project_logs")).toBe(true);
    expect(tables.some((t) => t.name === "work_sessions")).toBe(true);
    const logCols = db.prepare("PRAGMA table_info(project_logs)").all() as ColumnInfo[];
    expect(logCols.map((c) => c.name).sort()).toEqual(["body", "created_at", "id", "project_id"]);
    const sessionCols = db.prepare("PRAGMA table_info(work_sessions)").all() as ColumnInfo[];
    expect(sessionCols.map((c) => c.name).sort()).toEqual(["ended_at", "id", "project_id", "started_at"]);
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(6);
  });

  it("should_create_indexes_for_project_logs_and_work_sessions_on_fresh_db", () => {
    const db = new DatabaseSync(":memory:");
    migrate(db);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_project_logs_project");
    expect(indexNames).toContain("idx_work_sessions_project");
    expect(indexNames).toContain("idx_work_sessions_open");
  });

  it("should_migrate_v5_db_to_v6_preserving_existing_rows_and_adding_new_tables", () => {
    const db = new DatabaseSync(":memory:");
    // v5 스키마(project_logs/work_sessions 없음) 재현 — 기존 사용자 .db 상황.
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT '', genre TEXT NOT NULL DEFAULT '', target_length INTEGER,
        next_scene TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE documents (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
        body_json TEXT NOT NULL DEFAULT '', plain_text TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 5;
    `);
    db.prepare("INSERT INTO projects (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "p1",
      "기존 작품",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );

    migrate(db);

    // 기존 데이터 보존
    const row = db.prepare("SELECT title FROM projects WHERE id='p1'").get() as { title: string };
    expect(row.title).toBe("기존 작품");
    // 신규 테이블 생성
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    expect(tables.some((t) => t.name === "project_logs")).toBe(true);
    expect(tables.some((t) => t.name === "work_sessions")).toBe(true);
    // 버전 상승
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(6);
  });

  it("should_add_next_scene_and_pinned_to_legacy_v4_db_keeping_rows", () => {
    const db = new DatabaseSync(":memory:");
    // v4 스키마(projects.next_scene / memo_projects.pinned 없음) 재현 — 기존 사용자 .db.
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT '', genre TEXT NOT NULL DEFAULT '', target_length INTEGER,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE memos (
        id TEXT PRIMARY KEY, body TEXT NOT NULL, captured_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'app', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      ) STRICT;
      CREATE TABLE memo_projects (
        memo_id TEXT NOT NULL, project_id TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY (memo_id, project_id)
      ) STRICT;
      PRAGMA user_version = 4;
    `);
    db.prepare("INSERT INTO projects (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "p1",
      "옛 작품",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );
    db.prepare(
      "INSERT INTO memos (id, body, captured_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m1", "옛 메모", "2026-01-02T00:00:00.000Z", "app", "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    db.prepare("INSERT INTO memo_projects (memo_id, project_id, created_at) VALUES (?, ?, ?)").run(
      "m1",
      "p1",
      "2026-01-02T00:00:00.000Z",
    );

    migrate(db);

    const pRow = db.prepare("SELECT title, next_scene FROM projects WHERE id='p1'").get() as {
      title: string;
      next_scene: string;
    };
    expect(pRow.title).toBe("옛 작품");
    expect(pRow.next_scene).toBe("");
    const mpRow = db.prepare("SELECT memo_id, project_id, pinned FROM memo_projects").get() as {
      memo_id: string;
      project_id: string;
      pinned: number;
    };
    expect(mpRow).toEqual({ memo_id: "m1", project_id: "p1", pinned: 0 });
    expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(6);
  });
});
