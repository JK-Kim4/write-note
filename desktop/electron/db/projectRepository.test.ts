// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { ProjectRepository } from "./projectRepository";

describe("ProjectRepository", () => {
  let db: DatabaseSync;
  let repo: ProjectRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    repo = new ProjectRepository(db);
  });

  it("should_create_project_with_generated_uuid_and_timestamps", () => {
    const p = repo.create({ title: "바다가 보이는 방" });
    expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(p.title).toBe("바다가 보이는 방");
    expect(p.summary).toBe("");
    expect(p.targetLength).toBeNull();
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it("should_return_project_by_id", () => {
    const created = repo.create({ title: "T", summary: "한 줄", targetLength: 50000 });
    expect(repo.getById(created.id)).toEqual(created);
  });

  it("should_return_null_when_project_not_found", () => {
    expect(repo.getById("missing")).toBeNull();
  });

  it("should_list_projects_newest_first", () => {
    repo.create({ title: "A" });
    repo.create({ title: "B" });
    const titles = repo.list().map((p) => p.title);
    expect(titles).toHaveLength(2);
    expect(titles).toContain("A");
    expect(titles).toContain("B");
  });

  it("should_update_title_and_keep_other_fields", () => {
    const p = repo.create({ title: "old", summary: "유지" });
    const updated = repo.update(p.id, { title: "new" });
    expect(updated?.title).toBe("new");
    expect(updated?.summary).toBe("유지");
  });

  it("should_return_null_when_updating_missing_project", () => {
    expect(repo.update("missing", { title: "x" })).toBeNull();
  });

  it("should_create_and_read_project_with_genre", () => {
    const p = repo.create({ title: "T", genre: "단편소설" });
    expect(p.genre).toBe("단편소설");
    expect(repo.getById(p.id)?.genre).toBe("단편소설");
  });

  it("should_default_genre_to_empty_string", () => {
    expect(repo.create({ title: "T" }).genre).toBe("");
  });

  it("should_update_genre", () => {
    const p = repo.create({ title: "T" });
    expect(repo.update(p.id, { genre: "시" })?.genre).toBe("시");
  });

  it("should_delete_project", () => {
    const p = repo.create({ title: "삭제될 작품" });
    expect(repo.delete(p.id)).toBe(true);
    expect(repo.getById(p.id)).toBeNull();
  });

  it("should_return_false_when_deleting_missing_project", () => {
    expect(repo.delete("missing")).toBe(false);
  });

  it("should_cascade_delete_documents_when_project_deleted", () => {
    const p = repo.create({ title: "T" });
    db.prepare(
      "INSERT INTO documents (id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run("doc-1", p.id, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    repo.delete(p.id);
    const docs = db.prepare("SELECT id FROM documents WHERE project_id = ?").all(p.id);
    expect(docs).toHaveLength(0);
  });

  it("should_order_by_updated_at_desc_then_created_at_desc", () => {
    const a = repo.create({ title: "A" });
    const b = repo.create({ title: "B" });
    const c = repo.create({ title: "C" });
    // 결정적 timestamp 부여(:memory: 테스트 DB 직접 셋업 — new Date() ms 동률 회피).
    const set = db.prepare("UPDATE projects SET created_at = ?, updated_at = ? WHERE id = ?");
    set.run("2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z", a.id);
    set.run("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z", b.id);
    set.run("2026-01-03T00:00:00.000Z", "2026-01-01T00:00:00.000Z", c.id);
    // updated_at: A=01-03 최신 → 맨 위. B·C 는 updated_at 동률(01-01) → created_at DESC tiebreaker → C(01-03) > B(01-02).
    expect(repo.list().map((p) => p.title)).toEqual(["A", "C", "B"]);
  });
});
