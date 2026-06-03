import type { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 2;

/**
 * 엔티티 테이블을 생성하고, 기존 DB 는 버전에 맞춰 올린다(설계 §데이터 모델).
 * 신규 DB 는 IF NOT EXISTS 로 최신 스키마, 기존 DB 는 user_version 기준 ALTER.
 * v2: projects.genre 추가.
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
      linked_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
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

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
