// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { Store } from "./store";

describe("Store", () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(createDb(":memory:"));
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
});
