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
});
