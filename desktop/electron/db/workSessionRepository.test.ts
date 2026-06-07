// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { ProjectRepository } from "./projectRepository";
import { WorkSessionRepository } from "./workSessionRepository";

describe("WorkSessionRepository", () => {
  let db: DatabaseSync;
  let repo: WorkSessionRepository;
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    projectRepo = new ProjectRepository(db);
    repo = new WorkSessionRepository(db);
  });

  // start: 새 세션 생성 + 작품당 열린 세션 1개 보장
  it("should_start_session_and_return_it", () => {
    const project = projectRepo.create({ title: "작품A" });
    const session = repo.start(project.id);

    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.projectId).toBe(project.id);
    expect(session.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(session.endedAt).toBeNull();
  });

  it("should_guarantee_one_open_session_per_project_by_closing_previous_on_start", () => {
    const project = projectRepo.create({ title: "작품A" });
    // 첫 start — 30초 이전이면 폐기, 충분히 이전 시각으로 직접 박음
    const first = repo.start(project.id);
    // started_at 을 61초 전으로 조작 (30s 폐기 경계 회피)
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(
      "2000-01-01T00:00:00.000Z",
      first.id,
    );

    // 두 번째 start → 첫 세션이 닫히고 새 세션이 열린다
    const second = repo.start(project.id);
    expect(second.id).not.toBe(first.id);
    expect(second.endedAt).toBeNull();

    // DB 에서 first 는 ended_at 이 찍혔거나 30s 미만 폐기됨 — 열린 세션은 정확히 1개
    const openSessions = db
      .prepare("SELECT * FROM work_sessions WHERE project_id = ? AND ended_at IS NULL")
      .all(project.id) as Array<{ id: string }>;
    expect(openSessions).toHaveLength(1);
    expect(openSessions[0].id).toBe(second.id);
  });

  // endOpen: 정상 종료 (30s 이상)
  it("should_end_open_session_when_duration_meets_minimum", () => {
    const project = projectRepo.create({ title: "작품A" });
    const session = repo.start(project.id);
    // started_at 을 1분 전으로 설정
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(
      "2000-01-01T00:00:00.000Z",
      session.id,
    );

    repo.endOpen(project.id, "2000-01-01T00:01:00.000Z");

    const row = db
      .prepare("SELECT * FROM work_sessions WHERE id = ?")
      .get(session.id) as { ended_at: string | null } | undefined;
    expect(row?.ended_at).toBe("2000-01-01T00:01:00.000Z");
  });

  // endOpen: 30s 미만 폐기
  it("should_delete_session_when_duration_is_less_than_30s", () => {
    const project = projectRepo.create({ title: "작품A" });
    const session = repo.start(project.id);
    // started_at = T+0, endedAt = T+29s
    const start = "2000-01-01T00:00:00.000Z";
    const end = "2000-01-01T00:00:29.000Z";
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(start, session.id);

    repo.endOpen(project.id, end);

    const row = db.prepare("SELECT * FROM work_sessions WHERE id = ?").get(session.id);
    expect(row).toBeUndefined();
  });

  // endOpen: 열린 세션 없으면 아무것도 안 함 (graceful)
  it("should_do_nothing_when_no_open_session_exists", () => {
    const project = projectRepo.create({ title: "작품A" });
    // 열린 세션 없는 상태에서 endOpen — 예외 없이 종료
    expect(() => repo.endOpen(project.id, new Date().toISOString())).not.toThrow();
  });

  // endAllOpenSessions: 모든 작품의 열린 세션 종료
  it("should_end_all_open_sessions_across_projects", () => {
    const p1 = projectRepo.create({ title: "작품A" });
    const p2 = projectRepo.create({ title: "작품B" });
    const s1 = repo.start(p1.id);
    const s2 = repo.start(p2.id);
    // 충분히 이전 시각으로 설정 (30s 폐기 회피)
    const pastStart = "2000-01-01T00:00:00.000Z";
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(pastStart, s1.id);
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(pastStart, s2.id);

    const endAt = "2000-01-01T01:00:00.000Z";
    repo.endAllOpenSessions(endAt);

    const openCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM work_sessions WHERE ended_at IS NULL").get() as {
        cnt: number;
      }
    ).cnt;
    expect(openCount).toBe(0);
  });

  it("should_discard_short_sessions_in_endAllOpenSessions", () => {
    const project = projectRepo.create({ title: "작품A" });
    const session = repo.start(project.id);
    // 29s 이내 → 폐기
    const start = "2000-01-01T00:00:00.000Z";
    const end = "2000-01-01T00:00:29.000Z";
    db.prepare("UPDATE work_sessions SET started_at = ? WHERE id = ?").run(start, session.id);

    repo.endAllOpenSessions(end);

    const row = db.prepare("SELECT * FROM work_sessions WHERE id = ?").get(session.id);
    expect(row).toBeUndefined();
  });

  // closeDangling: ended_at IS NULL 세션 삭제
  it("should_delete_dangling_sessions_on_close", () => {
    const project = projectRepo.create({ title: "작품A" });
    repo.start(project.id);

    repo.closeDangling();

    const openCount = (
      db.prepare("SELECT COUNT(*) as cnt FROM work_sessions WHERE ended_at IS NULL").get() as {
        cnt: number;
      }
    ).cnt;
    expect(openCount).toBe(0);
  });

  it("should_preserve_completed_sessions_when_closing_dangling", () => {
    const project = projectRepo.create({ title: "작품A" });
    const session = repo.start(project.id);
    // 종료된 세션 (60s)
    db.prepare("UPDATE work_sessions SET started_at = ?, ended_at = ? WHERE id = ?").run(
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:01:00.000Z",
      session.id,
    );
    // 새 열린 세션
    repo.start(project.id);

    repo.closeDangling();

    // 종료된 세션은 남아 있고, 열린 세션만 삭제
    const total = (
      db.prepare("SELECT COUNT(*) as cnt FROM work_sessions").get() as { cnt: number }
    ).cnt;
    expect(total).toBe(1);
    const remaining = db.prepare("SELECT * FROM work_sessions WHERE id = ?").get(session.id);
    expect(remaining).toBeDefined();
  });

  // totalDurationMsByProject: 종료된 세션 합산
  it("should_sum_duration_of_completed_sessions", () => {
    const project = projectRepo.create({ title: "작품A" });
    // 1분 세션
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      project.id,
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:01:00.000Z",
    );
    // 2분 세션
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      project.id,
      "2000-01-01T01:00:00.000Z",
      "2000-01-01T01:02:00.000Z",
    );

    const total = repo.totalDurationMsByProject(project.id);
    expect(total).toBe(180_000); // 1분 + 2분 = 3분 = 180_000ms
  });

  it("should_exclude_open_sessions_from_total_duration", () => {
    const project = projectRepo.create({ title: "작품A" });
    // 완료된 1분 세션
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      project.id,
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:01:00.000Z",
    );
    // 열린 세션 (ended_at = null)
    repo.start(project.id);

    const total = repo.totalDurationMsByProject(project.id);
    expect(total).toBe(60_000); // 완료된 1분만
  });

  it("should_return_0_when_no_completed_sessions", () => {
    const project = projectRepo.create({ title: "작품A" });
    expect(repo.totalDurationMsByProject(project.id)).toBe(0);
  });

  it("should_not_include_other_project_sessions_in_total", () => {
    const p1 = projectRepo.create({ title: "작품A" });
    const p2 = projectRepo.create({ title: "작품B" });
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(crypto.randomUUID(), p1.id, "2000-01-01T00:00:00.000Z", "2000-01-01T00:01:00.000Z");
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(crypto.randomUUID(), p2.id, "2000-01-01T00:00:00.000Z", "2000-01-01T00:02:00.000Z");

    expect(repo.totalDurationMsByProject(p1.id)).toBe(60_000);
    expect(repo.totalDurationMsByProject(p2.id)).toBe(120_000);
  });

  // CASCADE: 작품 삭제 시 세션 삭제
  it("should_cascade_delete_sessions_when_project_deleted", () => {
    const project = projectRepo.create({ title: "작품A" });
    db.prepare(
      "INSERT INTO work_sessions (id, project_id, started_at, ended_at) VALUES (?, ?, ?, ?)",
    ).run(
      crypto.randomUUID(),
      project.id,
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:01:00.000Z",
    );

    projectRepo.delete(project.id);

    const count = (
      db.prepare("SELECT COUNT(*) as cnt FROM work_sessions WHERE project_id = ?").get(project.id) as {
        cnt: number;
      }
    ).cnt;
    expect(count).toBe(0);
  });
});
