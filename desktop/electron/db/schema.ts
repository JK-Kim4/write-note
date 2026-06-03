import type { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

/** 4 엔티티 테이블을 생성한다(설계 §데이터 모델). 멱등 — IF NOT EXISTS. */
export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      summary       TEXT NOT NULL DEFAULT '',
      tone          TEXT NOT NULL DEFAULT '',
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
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
