// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDb } from "./connection";

describe("createDb", () => {
  it("4 엔티티 테이블을 생성한다", () => {
    const db = createDb(":memory:");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(["app_settings", "documents", "memos", "projects"]);
  });

  it("foreign_keys PRAGMA 가 켜져 있다", () => {
    const db = createDb(":memory:");
    const [{ foreign_keys }] = db.prepare("PRAGMA foreign_keys").all() as Array<{ foreign_keys: number }>;
    expect(foreign_keys).toBe(1);
  });
});
