// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { Store } from "./store";

describe("Store", () => {
  let db: DatabaseSync;
  let store: Store;

  beforeEach(() => {
    db = createDb(":memory:");
    store = new Store(db);
  });

  it("should_create_project_with_default_document", () => {
    const { project, document } = store.createProjectWithDocument({ title: "신작" });
    expect(project.title).toBe("신작");
    expect(document.projectId).toBe(project.id);
    // 자동 생성된 document 가 해당 project 로 조회된다(완료기준).
    expect(store.documents.getByProjectId(project.id)?.id).toBe(document.id);
  });

  it("should_expose_all_repositories", () => {
    expect(store.projects).toBeDefined();
    expect(store.documents).toBeDefined();
    expect(store.memos).toBeDefined();
    expect(store.settings).toBeDefined();
  });

  it("should_update_document_body_and_return_it", () => {
    const { document } = store.createProjectWithDocument({ title: "신작" });
    const updated = store.updateDocument(document.id, {
      bodyJson: '{"type":"doc","content":[]}',
      plainText: "첫 문장",
      wordCount: 3,
    });
    expect(updated?.bodyJson).toBe('{"type":"doc","content":[]}');
    expect(updated?.plainText).toBe("첫 문장");
    expect(updated?.wordCount).toBe(3);
  });

  it("should_touch_project_updated_at_when_document_saved", () => {
    const { project, document } = store.createProjectWithDocument({ title: "신작" });
    // 생성 직후 시각과 구분되도록 project.updated_at 을 과거로 강제한다.
    const past = "2000-01-01T00:00:00.000Z";
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(past, project.id);

    store.updateDocument(document.id, { plainText: "한 글자 더", wordCount: 5 });

    expect(store.projects.getById(project.id)?.updatedAt).not.toBe(past);
  });
});
