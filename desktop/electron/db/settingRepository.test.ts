// @vitest-environment node
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./connection";
import { SettingRepository } from "./settingRepository";

describe("SettingRepository", () => {
  let db: DatabaseSync;
  let repo: SettingRepository;

  beforeEach(() => {
    db = createDb(":memory:");
    repo = new SettingRepository(db);
  });

  it("should_return_null_for_missing_key", () => {
    expect(repo.get("theme")).toBeNull();
  });

  it("should_set_and_get_value", () => {
    repo.set("theme", "dark");
    expect(repo.get("theme")).toBe("dark");
  });

  it("should_overwrite_existing_key", () => {
    repo.set("theme", "light");
    repo.set("theme", "dark");
    expect(repo.get("theme")).toBe("dark");
  });
});
