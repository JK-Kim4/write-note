import type { DatabaseSync } from "node:sqlite";

/** key-value 앱 설정. upsert. */
export class SettingRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
      .run(key, value, value);
  }
}
