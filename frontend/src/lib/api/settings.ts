import { apiFetch } from "./client";

/**
 * 사용자 환경설정 서버 API (019 US2 / #37) — 다기기 동기화.
 *
 * 주의: 기존 `lib/electron-api/settings.ts` 는 임의 key-value 의 localStorage shim(015)이며 본 파일과 별개다.
 * 본 파일은 서버 영속(테마·작성 모드·원고지 크기)을 다룬다. 서버가 SoT, localStorage(preferences persist)는 캐시 미러.
 */

export type SettingsMap = Record<string, string>;

type SettingsEnvelope = { settings: SettingsMap };

/** GET /api/settings — 저장된 설정 맵(미저장 key 는 부재). */
export async function fetchSettings(): Promise<SettingsMap> {
    const res = await apiFetch<SettingsEnvelope>("/api/settings", { method: "GET" });
    return res.settings;
}

/** PUT /api/settings — 보낸 key 만 부분 upsert. 갱신 후 전체 맵 반환. */
export async function putSettings(partial: SettingsMap): Promise<SettingsMap> {
    const res = await apiFetch<SettingsEnvelope>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: partial }),
    });
    return res.settings;
}
