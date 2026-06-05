// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { ProjectRepository } from "./projectRepository";
import { MemoRepository } from "./memoRepository";

describe("MemoRepository", () => {
  let db: DatabaseSync;
  let repo: MemoRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    projectRepo = new ProjectRepository(db);
    repo = new MemoRepository(db);
  });

  it("should_create_unlinked_memo_by_default", () => {
    const m = repo.create({ body: "떠오른 생각" });
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.body).toBe("떠오른 생각");
    expect(m.linkedProjectId).toBeNull();
    expect(m.source).toBe("app");
    expect(m.capturedAt).toBeTruthy();
  });

  it("should_list_memos", () => {
    repo.create({ body: "A" });
    repo.create({ body: "B" });
    expect(repo.list()).toHaveLength(2);
  });

  it("should_link_memo_to_project", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    const linked = repo.link(m.id, p.id);
    expect(linked?.linkedProjectId).toBe(p.id);
  });

  it("should_null_linked_project_when_project_deleted", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모", linkedProjectId: p.id });
    db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);
    expect(repo.getById(m.id)?.linkedProjectId).toBeNull();
  });

  it("should_default_deleted_at_to_null_on_create", () => {
    const m = repo.create({ body: "x" });
    expect(m.deletedAt).toBeNull();
    expect(repo.getById(m.id)?.deletedAt).toBeNull();
  });

  it("should_exclude_soft_deleted_memos_from_list", () => {
    const active = repo.create({ body: "active" });
    const removed = repo.create({ body: "removed" });
    db.prepare("UPDATE memos SET deleted_at = ? WHERE id = ?").run("2026-06-05T00:00:00.000Z", removed.id);
    const ids = repo.list().map((m) => m.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(removed.id);
  });

  it("should_soft_delete_and_exclude_from_list", () => {
    const m = repo.create({ body: "지울 메모" });
    expect(repo.softDelete(m.id)).toBe(true);
    expect(repo.list().map((x) => x.id)).not.toContain(m.id);
    expect(repo.getById(m.id)?.deletedAt).toBeTruthy();
  });

  it("should_restore_soft_deleted_memo_back_into_list", () => {
    const m = repo.create({ body: "되살릴 메모" });
    repo.softDelete(m.id);
    const restored = repo.restore(m.id);
    expect(restored?.deletedAt).toBeNull();
    expect(repo.list().map((x) => x.id)).toContain(m.id);
  });

  it("should_return_false_or_null_for_missing_id", () => {
    expect(repo.softDelete("nope")).toBe(false);
    expect(repo.restore("nope")).toBeNull();
  });
});
