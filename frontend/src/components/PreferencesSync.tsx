"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { fetchSettings, putSettings, type SettingsMap } from "@/lib/api/settings";
import { usePreferences, type ManuscriptSize, type ThemeMode, type WritingMode } from "@/stores/preferences";

/**
 * 환경설정 서버 동기화 (019 US2 / #37) — 다기기 동기화.
 *
 * 서버 = SoT, zustand persist(localStorage) = 캐시 미러. 인증 확정 후 1회 hydrate:
 * 서버값이 있으면 store 에 주입(에코 PUT 방지), 없으면 현재 로컬값을 시딩 PUT(기존 사용자 설정 유실 금지).
 * 이후 store 변경을 디바운스로 PUT. 오프라인/서버 오류 시 로컬 store 가 그대로 동작(FR-009).
 *
 * FOUC 방지 inline script(layout.tsx)는 무변경 — localStorage 캐시를 읽어 첫 페인트에 테마 반영.
 */
const THEMES: readonly ThemeMode[] = ["light", "dark", "system"];
const WRITING_MODES: readonly WritingMode[] = ["manuscript", "editor"];
const MANUSCRIPT_SIZES: readonly ManuscriptSize[] = [200, 400, 1000];
const DEBOUNCE_MS = 600;

type PreferencesSnapshot = {
    theme: ThemeMode;
    writingMode: WritingMode;
    manuscriptSize: ManuscriptSize;
};

/** store → 서버 전송용 맵(manuscriptSize 는 문자열 직렬화). */
function toMap(s: PreferencesSnapshot): SettingsMap {
    return { theme: s.theme, writingMode: s.writingMode, manuscriptSize: String(s.manuscriptSize) };
}

export function PreferencesSync() {
    const { data, isError } = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });
    const isAuthed = data !== undefined && !isError;

    // 서버값을 store 에 주입하는 동안 true — subscribe 가 이 변경을 PUT 로 되돌리지 않도록(에코 방지).
    const applyingRef = useRef(false);
    const hydratedRef = useRef(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 인증 확정 후 1회 hydrate — 서버값 주입 또는 로컬값 시딩.
    useEffect(() => {
        if (!isAuthed || hydratedRef.current) return;
        hydratedRef.current = true;
        let cancelled = false;

        void (async () => {
            try {
                const server = await fetchSettings();
                if (cancelled) return;
                if (Object.keys(server).length === 0) {
                    // 서버에 설정이 없는 사용자 — 현재 로컬값을 최초 시딩(이후 변경분만 누적).
                    await putSettings(toMap(usePreferences.getState()));
                    return;
                }
                applyingRef.current = true;
                const { setTheme, setWritingMode, setManuscriptSize } = usePreferences.getState();
                if (server.theme && (THEMES as readonly string[]).includes(server.theme)) {
                    setTheme(server.theme as ThemeMode);
                }
                if (server.writingMode && (WRITING_MODES as readonly string[]).includes(server.writingMode)) {
                    setWritingMode(server.writingMode as WritingMode);
                }
                const size = Number(server.manuscriptSize);
                if ((MANUSCRIPT_SIZES as readonly number[]).includes(size)) {
                    setManuscriptSize(size as ManuscriptSize);
                }
                applyingRef.current = false;
            } catch {
                // 오프라인/서버 오류 — 로컬 store 가 SoT 로 유지(작성·표시 비차단).
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAuthed]);

    // store 변경 구독 → 디바운스 PUT. 서버 주입 중(applyingRef)에는 스킵.
    useEffect(() => {
        if (!isAuthed) return;
        const unsubscribe = usePreferences.subscribe((state) => {
            if (applyingRef.current) return;
            const snapshot = toMap(state);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                void putSettings(snapshot).catch(() => {
                    // 전송 실패는 무시 — 로컬은 이미 반영됨, 다음 변경/진입에서 재시도.
                });
            }, DEBOUNCE_MS);
        });
        return () => {
            unsubscribe();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [isAuthed]);

    return null;
}
