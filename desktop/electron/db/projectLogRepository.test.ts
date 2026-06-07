// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { ProjectRepository } from "./projectRepository";
import { ProjectLogRepository } from "./projectLogRepository";

describe("ProjectLogRepository", () => {
  let db: DatabaseSync;
  let repo: ProjectLogRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    projectRepo = new ProjectRepository(db);
    repo = new ProjectLogRepository(db);
  });

  it("should_create_log_with_generated_id_and_iso_timestamp", () => {
    const project = projectRepo.create({ title: "작품A" });
    const log = repo.create(project.id, "오늘도 3페이지 썼다");

    expect(log.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(log.projectId).toBe(project.id);
    expect(log.body).toBe("오늘도 3페이지 썼다");
    expect(log.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should_listByProject_in_created_at_desc_order", () => {
    const project = projectRepo.create({ title: "작품A" });
    repo.create(project.id, "첫 번째 기록");
    repo.create(project.id, "두 번째 기록");
    repo.create(project.id, "세 번째 기록");

    const logs = repo.listByProject(project.id);

    expect(logs).toHaveLength(3);
    // DESC 정렬 — created_at 을 결정적으로 부여해 순서 검증
    const bodies = logs.map((l) => l.body);
    // 생성 순서가 ms 단위라 동률 가능 — body 포함 확인
    expect(bodies).toContain("첫 번째 기록");
    expect(bodies).toContain("두 번째 기록");
    expect(bodies).toContain("세 번째 기록");
  });

  it("should_listByProject_return_empty_for_unknown_project", () => {
    expect(repo.listByProject("nonexistent")).toEqual([]);
  });

  it("should_listByProject_desc_order_with_explicit_created_at", () => {
    const project = projectRepo.create({ title: "작품A" });
    const log1 = repo.create(project.id, "기록1");
    const log2 = repo.create(project.id, "기록2");
    // 결정적 시각 부여
    db.prepare("UPDATE project_logs SET created_at = ? WHERE id = ?").run("2026-01-01T10:00:00.000Z", log1.id);
    db.prepare("UPDATE project_logs SET created_at = ? WHERE id = ?").run("2026-01-02T10:00:00.000Z", log2.id);

    const logs = repo.listByProject(project.id);
    expect(logs[0].id).toBe(log2.id); // 더 최신이 먼저
    expect(logs[1].id).toBe(log1.id);
  });

  it("should_latestByProject_return_most_recent_log", () => {
    const project = projectRepo.create({ title: "작품A" });
    const older = repo.create(project.id, "예전 기록");
    const newer = repo.create(project.id, "최신 기록");
    db.prepare("UPDATE project_logs SET created_at = ? WHERE id = ?").run("2026-01-01T00:00:00.000Z", older.id);
    db.prepare("UPDATE project_logs SET created_at = ? WHERE id = ?").run("2026-01-02T00:00:00.000Z", newer.id);

    const latest = repo.latestByProject(project.id);
    expect(latest?.id).toBe(newer.id);
    expect(latest?.body).toBe("최신 기록");
  });

  it("should_latestByProject_return_null_when_no_logs", () => {
    const project = projectRepo.create({ title: "작품A" });
    expect(repo.latestByProject(project.id)).toBeNull();
  });

  it("should_cascade_delete_logs_when_project_deleted", () => {
    const project = projectRepo.create({ title: "작품A" });
    repo.create(project.id, "기록1");
    repo.create(project.id, "기록2");

    expect(repo.listByProject(project.id)).toHaveLength(2);

    projectRepo.delete(project.id);

    expect(repo.listByProject(project.id)).toHaveLength(0);
  });

  it("should_not_mix_logs_between_projects", () => {
    const p1 = projectRepo.create({ title: "작품A" });
    const p2 = projectRepo.create({ title: "작품B" });
    repo.create(p1.id, "A의 기록");
    repo.create(p2.id, "B의 기록");

    const p1Logs = repo.listByProject(p1.id);
    const p2Logs = repo.listByProject(p2.id);

    expect(p1Logs).toHaveLength(1);
    expect(p1Logs[0].body).toBe("A의 기록");
    expect(p2Logs).toHaveLength(1);
    expect(p2Logs[0].body).toBe("B의 기록");
  });
});
