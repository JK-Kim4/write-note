import { DatabaseSync } from "node:sqlite";
import { migrate } from "./schema";

/**
 * SQLite 연결을 연다. electron `app` 에 의존하지 않도록 경로를 주입받는다
 * (테스트는 `:memory:`, main 은 userData 경로).
 */
export function createDb(filePath: string): DatabaseSync {
  const db = new DatabaseSync(filePath);
  db.exec("PRAGMA foreign_keys = ON");
  // WAL 은 파일 DB 에서만 의미 — :memory: 에선 무시된다.
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}
