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

  it("should_capture_memo_and_link_to_project_atomically", () => {
    const { project } = store.createProjectWithDocument({ title: "작품" });
    const memo = store.captureMemo({ body: "현재 작품 메모", linkProjectId: project.id });
    expect(memo.body).toBe("현재 작품 메모");
    expect(memo.linkedProjectIds).toEqual([project.id]);
    expect(store.memos.listByProject(project.id).map((m) => m.id)).toEqual([memo.id]);
  });

  it("should_capture_unlinked_memo_when_no_project_given", () => {
    const memo = store.captureMemo({ body: "미연결 메모" });
    expect(memo.linkedProjectIds).toEqual([]);
    expect(store.memos.list().map((m) => m.id)).toContain(memo.id);
  });

  it("should_rollback_memo_when_link_fails", () => {
    // 존재하지 않는 작품 id → memo_projects FK 위반 → 트랜잭션 롤백(메모도 생성 안 됨)
    expect(() => store.captureMemo({ body: "깨질 메모", linkProjectId: "nonexistent" })).toThrow();
    expect(store.memos.list()).toHaveLength(0);
  });
});
