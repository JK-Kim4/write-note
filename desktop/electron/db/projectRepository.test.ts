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
});
