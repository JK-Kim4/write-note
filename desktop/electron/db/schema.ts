import type { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 5;

/**
 * 엔티티 테이블을 생성하고, 기존 DB 는 버전에 맞춰 올린다(설계 §데이터 모델).
 * 신규 DB 는 IF NOT EXISTS 로 최신 스키마, 기존 DB 는 user_version 기준 ALTER.
 * v2: projects.genre 추가. v3: memos.deleted_at 추가(soft delete).
 * v4: memo_projects 연결 테이블(메모↔작품 다대다) 추가 + memos.linked_project_id 은퇴.
 * v5: projects.next_scene(다음에 쓸 장면) + memo_projects.pinned(곁에 둘 쪽지 고정) 추가.
 */
export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      summary       TEXT NOT NULL DEFAULT '',
      tone          TEXT NOT NULL DEFAULT '',
      genre         TEXT NOT NULL DEFAULT '',
      target_length INTEGER,
      next_scene    TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT '',
      body_json   TEXT NOT NULL DEFAULT '',
      plain_text  TEXT NOT NULL DEFAULT '',
      word_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS memos (
      id                TEXT PRIMARY KEY,
      body              TEXT NOT NULL,
      captured_at       TEXT NOT NULL,
      source            TEXT NOT NULL DEFAULT 'app',
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      deleted_at        TEXT
    ) STRICT;

    CREATE TABLE IF NOT EXISTS memo_projects (
      memo_id    TEXT NOT NULL REFERENCES memos(id)    ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      pinned     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (memo_id, project_id)
    ) STRICT;

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
  `);

  // 기존 DB 업그레이드 — CREATE IF NOT EXISTS 는 이미 있는 테이블에 컬럼을 더하지 않는다.
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (version < 2) {
    const cols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "genre")) {
      db.exec("ALTER TABLE projects ADD COLUMN genre TEXT NOT NULL DEFAULT ''");
    }
  }
  if (version < 3) {
    const cols = db.prepare("PRAGMA table_info(memos)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "deleted_at")) {
      db.exec("ALTER TABLE memos ADD COLUMN deleted_at TEXT");
    }
  }
  if (version < 4) {
    const cols = db.prepare("PRAGMA table_info(memos)").all() as Array<{ name: string }>;
    if (cols.some((c) => c.name === "linked_project_id")) {
      // 기존 단일 연결을 연결 행으로 보존 이관 후 컬럼 은퇴(SQLite 3.35+ DROP COLUMN, 실측 검증).
      db.exec(`
        INSERT OR IGNORE INTO memo_projects (memo_id, project_id, created_at)
        SELECT id, linked_project_id, updated_at FROM memos WHERE linked_project_id IS NOT NULL
      `);
      db.exec("ALTER TABLE memos DROP COLUMN linked_project_id");
    }
  }
  if (version < 5) {
    const pcols = db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (!pcols.some((c) => c.name === "next_scene")) {
      db.exec("ALTER TABLE projects ADD COLUMN next_scene TEXT NOT NULL DEFAULT ''");
    }
    const mpcols = db.prepare("PRAGMA table_info(memo_projects)").all() as Array<{ name: string }>;
    if (!mpcols.some((c) => c.name === "pinned")) {
      db.exec("ALTER TABLE memo_projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
    }
  }

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
