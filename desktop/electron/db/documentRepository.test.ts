// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { ProjectRepository } from "./projectRepository";
import { DocumentRepository } from "./documentRepository";

describe("DocumentRepository", () => {
  let db: DatabaseSync;
  let repo: DocumentRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    projectRepo = new ProjectRepository(db);
    repo = new DocumentRepository(db);
  });

  it("should_create_empty_document_for_project", () => {
    const p = projectRepo.create({ title: "P" });
    const d = repo.create({ projectId: p.id });
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.projectId).toBe(p.id);
    expect(d.bodyJson).toBe("");
    expect(d.wordCount).toBe(0);
  });

  it("should_get_document_by_project_id", () => {
    const p = projectRepo.create({ title: "P" });
    const d = repo.create({ projectId: p.id });
    expect(repo.getByProjectId(p.id)).toEqual(d);
  });

  it("should_reject_document_for_missing_project_due_to_fk", () => {
    expect(() => repo.create({ projectId: "missing" })).toThrow();
  });

  it("should_update_body_plaintext_and_word_count", () => {
    const p = projectRepo.create({ title: "P" });
    const d = repo.create({ projectId: p.id });
    const u = repo.update(d.id, { bodyJson: '{"type":"doc"}', plainText: "hello world", wordCount: 2 });
    expect(u?.bodyJson).toBe('{"type":"doc"}');
    expect(u?.plainText).toBe("hello world");
    expect(u?.wordCount).toBe(2);
  });

  it("should_cascade_delete_document_when_project_deleted", () => {
    const p = projectRepo.create({ title: "P" });
    repo.create({ projectId: p.id });
    db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);
    expect(repo.getByProjectId(p.id)).toBeNull();
  });
});
