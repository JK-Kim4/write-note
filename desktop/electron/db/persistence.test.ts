// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { Store } from "./store";

describe("persistence (파일 DB 재시작 유지)", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("should_persist_project_and_document_across_reopen", () => {
    dir = mkdtempSync(path.join(tmpdir(), "write-note-"));
    const file = path.join(dir, "write-note.db");

    // 1차 세션: 생성 후 연결 닫기(앱 종료 모사).
    const db1 = createDb(file);
    const { project, document } = new Store(db1).createProjectWithDocument({ title: "유지될 프로젝트" });
    db1.close();

    // 2차 세션: 새 연결로 재오픈(앱 재시작 모사).
    const db2 = createDb(file);
    const store2 = new Store(db2);
    expect(store2.projects.getById(project.id)?.title).toBe("유지될 프로젝트");
    expect(store2.documents.getByProjectId(project.id)?.id).toBe(document.id);
    db2.close();
  });
});
