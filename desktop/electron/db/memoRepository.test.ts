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
    expect(m.linkedProjectIds).toEqual([]);
    expect(m.source).toBe("app");
    expect(m.capturedAt).toBeTruthy();
  });

  it("should_list_memos", () => {
    repo.create({ body: "A" });
    repo.create({ body: "B" });
    expect(repo.list()).toHaveLength(2);
  });

  it("should_add_link_and_reflect_in_linkedProjectIds", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    expect(repo.getById(m.id)?.linkedProjectIds).toEqual([p.id]);
  });

  it("should_be_idempotent_when_adding_same_link_twice", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    repo.addLink(m.id, p.id);
    expect(repo.getById(m.id)?.linkedProjectIds).toEqual([p.id]);
  });

  it("should_link_one_memo_to_multiple_projects", () => {
    const a = projectRepo.create({ title: "A" });
    const b = projectRepo.create({ title: "B" });
    const m = repo.create({ body: "공통 메모" });
    repo.addLink(m.id, a.id);
    repo.addLink(m.id, b.id);
    expect(repo.getById(m.id)?.linkedProjectIds.sort()).toEqual([a.id, b.id].sort());
  });

  it("should_remove_link", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    repo.removeLink(m.id, p.id);
    expect(repo.getById(m.id)?.linkedProjectIds).toEqual([]);
  });

  it("should_list_memos_by_project_excluding_others_and_soft_deleted", () => {
    const a = projectRepo.create({ title: "A" });
    const b = projectRepo.create({ title: "B" });
    const onA = repo.create({ body: "A 메모", capturedAt: "2026-06-01T00:00:00.000Z" });
    const onB = repo.create({ body: "B 메모" });
    const onADeleted = repo.create({ body: "A 삭제 메모", capturedAt: "2026-06-02T00:00:00.000Z" });
    repo.addLink(onA.id, a.id);
    repo.addLink(onB.id, b.id);
    repo.addLink(onADeleted.id, a.id);
    repo.softDelete(onADeleted.id);

    const ids = repo.listByProject(a.id).map((m) => m.id);
    expect(ids).toEqual([onA.id]); // B·삭제분 제외
  });

  it("should_order_listByProject_by_captured_at_desc", () => {
    const a = projectRepo.create({ title: "A" });
    const older = repo.create({ body: "older", capturedAt: "2026-06-01T00:00:00.000Z" });
    const newer = repo.create({ body: "newer", capturedAt: "2026-06-03T00:00:00.000Z" });
    repo.addLink(older.id, a.id);
    repo.addLink(newer.id, a.id);
    expect(repo.listByProject(a.id).map((m) => m.id)).toEqual([newer.id, older.id]);
  });

  it("should_keep_memo_on_other_projects_when_one_link_removed", () => {
    const a = projectRepo.create({ title: "A" });
    const b = projectRepo.create({ title: "B" });
    const m = repo.create({ body: "공통" });
    repo.addLink(m.id, a.id);
    repo.addLink(m.id, b.id);
    repo.removeLink(m.id, a.id);
    expect(repo.listByProject(a.id)).toHaveLength(0);
    expect(repo.listByProject(b.id).map((x) => x.id)).toEqual([m.id]);
  });

  it("should_cascade_remove_links_but_keep_memo_when_project_deleted", () => {
    // FR-011: 작품 삭제 → 그 작품 연결 행만 사라지고 메모는 보존
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    projectRepo.delete(p.id);
    expect(repo.getById(m.id)?.linkedProjectIds).toEqual([]);
    expect(repo.list().map((x) => x.id)).toContain(m.id);
  });

  it("should_default_linkedProjectIds_empty_on_create", () => {
    const m = repo.create({ body: "x" });
    expect(m.deletedAt).toBeNull();
    expect(repo.getById(m.id)?.linkedProjectIds).toEqual([]);
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

  it("should_restore_soft_deleted_memo_with_links_preserved", () => {
    // FR-012: soft delete 후 복원 시 연결이 그대로 복귀
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "되살릴 메모" });
    repo.addLink(m.id, p.id);
    repo.softDelete(m.id);
    expect(repo.listByProject(p.id)).toHaveLength(0); // 삭제 중엔 패널에서 제외
    const restored = repo.restore(m.id);
    expect(restored?.deletedAt).toBeNull();
    expect(repo.list().map((x) => x.id)).toContain(m.id);
    expect(repo.listByProject(p.id).map((x) => x.id)).toEqual([m.id]); // 연결 복귀
  });

  it("should_return_false_or_null_for_missing_id", () => {
    expect(repo.softDelete("nope")).toBe(false);
    expect(repo.restore("nope")).toBeNull();
  });

  it("should_pin_one_memo_per_project_clearing_others", () => {
    // US6: 작품당 곁쪽지 1개 — 새로 고정하면 같은 작품의 기존 고정이 해제된다.
    const p = projectRepo.create({ title: "P" });
    const first = repo.create({ body: "처음 고정" });
    const second = repo.create({ body: "나중 고정" });
    repo.addLink(first.id, p.id);
    repo.addLink(second.id, p.id);

    repo.setPin(first.id, p.id, true);
    expect(pinnedOf(repo.listByProject(p.id), first.id)).toBe(true);

    repo.setPin(second.id, p.id, true);
    const rows = repo.listByProject(p.id);
    expect(pinnedOf(rows, second.id)).toBe(true);
    expect(pinnedOf(rows, first.id)).toBe(false); // 기존 고정 해제
  });

  it("should_unpin_when_setPin_false", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    repo.setPin(m.id, p.id, true);
    repo.setPin(m.id, p.id, false);
    expect(pinnedOf(repo.listByProject(p.id), m.id)).toBe(false);
  });

  it("should_pin_independently_per_project", () => {
    // 같은 메모가 두 작품에 연결되면 작품별 고정은 독립적이다.
    const a = projectRepo.create({ title: "A" });
    const b = projectRepo.create({ title: "B" });
    const m = repo.create({ body: "공통" });
    repo.addLink(m.id, a.id);
    repo.addLink(m.id, b.id);
    repo.setPin(m.id, a.id, true);
    expect(pinnedOf(repo.listByProject(a.id), m.id)).toBe(true);
    expect(pinnedOf(repo.listByProject(b.id), m.id)).toBe(false);
  });

  it("should_drop_pin_when_link_removed_and_reset_on_relink", () => {
    // removeLink 로 연결 행이 사라지면 고정도 소멸, 재연결 시 pinned 기본 0.
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    repo.setPin(m.id, p.id, true);
    repo.removeLink(m.id, p.id);
    repo.addLink(m.id, p.id);
    expect(pinnedOf(repo.listByProject(p.id), m.id)).toBe(false);
  });

  it("should_return_project_memos_with_pinned_flag", () => {
    const p = projectRepo.create({ title: "P" });
    const m = repo.create({ body: "메모" });
    repo.addLink(m.id, p.id);
    const [row] = repo.listByProject(p.id);
    expect(row.pinned).toBe(false);
    repo.setPin(m.id, p.id, true);
    expect(repo.listByProject(p.id)[0].pinned).toBe(true);
  });
});

function pinnedOf(rows: ReadonlyArray<{ id: string; pinned: boolean }>, id: string): boolean {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`memo ${id} not in listByProject result`);
  return row.pinned;
}
