"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { fetchSettings, putSettings, type SettingsMap } from "@/lib/api/settings";
import {
    DAILY_GOAL_MINUTES,
    PREFERENCE_DEFAULTS,
    usePreferences,
    type DailyGoalMinutes,
    type ManuscriptSize,
    type PaperSize,
    type ThemeMode,
    type WritingMode,
} from "@/stores/preferences";

/**
 * 환경설정 서버 동기화 (019 US2 / #37) — 다기기 동기화.
 *
 * 서버 = SoT, zustand persist(localStorage) = 캐시 미러. 인증 확정 후 사용자 단위 1회 hydrate:
 * 서버값이 있으면 store 에 주입(에코 PUT 방지), 없으면 현재 로컬값을 시딩 PUT(기존 사용자 설정 유실 금지).
 * 이후 store 변경을 디바운스로 PUT. 오프라인/서버 오류 시 로컬 store 가 그대로 동작(FR-009).
 *
 * 계정 전환 격리 (019 버그픽스 F): 로그아웃→재로그인이 SPA 내 전환이라 컴포넌트가 살아있는 채
 * me 가 바뀐다 — hydrate 를 userId 단위로 다시 수행하고, 직전 hydrate 계정(`wn:prefsOwner`)과
 * 다른 계정의 빈 서버 설정에는 이전 계정 로컬값 대신 기본값을 리셋·시딩한다(설정 누수 방지).
 *
 * FOUC 방지 inline script(layout.tsx)는 무변경 — localStorage 캐시를 읽어 첫 페인트에 테마 반영.
 */
const THEMES: readonly ThemeMode[] = ["light", "dark", "system"];
const WRITING_MODES: readonly WritingMode[] = ["manuscript", "editor"];
const MANUSCRIPT_SIZES: readonly ManuscriptSize[] = [200, 400, 1000];
const PAPER_SIZES: readonly PaperSize[] = ["A4", "A3", "A2", "B4"];
const DEBOUNCE_MS = 600;
/** 이 브라우저에서 마지막으로 hydrate/시딩을 마친 계정 — 계정 전환 시 시딩 누수 방지용. */
const OWNER_KEY = "wn:prefsOwner";

type PreferencesSnapshot = {
    theme: ThemeMode;
    writingMode: WritingMode;
    manuscriptSize: ManuscriptSize;
    paperSize: PaperSize;
    dailyGoalMinutes: DailyGoalMinutes;
};

/** store → 서버 전송용 맵(숫자 설정은 문자열 직렬화). */
function toMap(s: PreferencesSnapshot): SettingsMap {
    return {
        theme: s.theme,
        writingMode: s.writingMode,
        manuscriptSize: String(s.manuscriptSize),
        paperSize: s.paperSize,
        dailyGoalMinutes: String(s.dailyGoalMinutes),
    };
}

export function PreferencesSync() {
    const { data, isError } = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });
    const isAuthed = data !== undefined && !isError;
    const userId = isAuthed ? data.userId : null;

    // 서버값을 store 에 주입하는 동안 true — subscribe 가 이 변경을 PUT 로 되돌리지 않도록(에코 방지).
    const applyingRef = useRef(false);
    // 마지막으로 hydrate 를 마친 userId — 계정이 바뀌면 다시 hydrate (버그픽스 F).
    const hydratedForRef = useRef<number | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 인증 확정 후 사용자 단위 1회 hydrate — 서버값 주입 또는 로컬값/기본값 시딩.
    useEffect(() => {
        if (userId === null || hydratedForRef.current === userId) return;
        hydratedForRef.current = userId;
        let cancelled = false;

        void (async () => {
            try {
                const server = await fetchSettings();
                if (cancelled) return;
                if (Object.keys(server).length === 0) {
                    // 이 브라우저에서 마지막으로 동기화한 계정이 다르면 로컬값은 이전 계정의 것 —
                    // 누수 방지로 기본값 리셋 후 기본값을 시딩한다. 같은 계정/최초(owner 없음)면 로컬값 시딩.
                    const owner = localStorage.getItem(OWNER_KEY);
                    if (owner !== null && owner !== String(userId)) {
                        applyingRef.current = true;
                        const { setTheme, setWritingMode, setManuscriptSize, setPaperSize, setDailyGoalMinutes } =
                            usePreferences.getState();
                        setTheme(PREFERENCE_DEFAULTS.theme);
                        setWritingMode(PREFERENCE_DEFAULTS.writingMode);
                        setManuscriptSize(PREFERENCE_DEFAULTS.manuscriptSize);
                        setPaperSize(PREFERENCE_DEFAULTS.paperSize);
                        setDailyGoalMinutes(PREFERENCE_DEFAULTS.dailyGoalMinutes);
                        applyingRef.current = false;
                        localStorage.setItem(OWNER_KEY, String(userId));
                        await putSettings(toMap(PREFERENCE_DEFAULTS));
                        return;
                    }
                    // 서버에 설정이 없는 사용자 — 현재 로컬값을 최초 시딩(이후 변경분만 누적).
                    localStorage.setItem(OWNER_KEY, String(userId));
                    await putSettings(toMap(usePreferences.getState()));
                    return;
                }
                applyingRef.current = true;
                const { setTheme, setWritingMode, setManuscriptSize, setPaperSize, setDailyGoalMinutes } =
                    usePreferences.getState();
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
                if (server.paperSize && (PAPER_SIZES as readonly string[]).includes(server.paperSize)) {
                    setPaperSize(server.paperSize as PaperSize);
                }
                const goal = Number(server.dailyGoalMinutes);
                if ((DAILY_GOAL_MINUTES as readonly number[]).includes(goal)) {
                    setDailyGoalMinutes(goal as DailyGoalMinutes);
                }
                applyingRef.current = false;
                localStorage.setItem(OWNER_KEY, String(userId));
            } catch {
                // 오프라인/서버 오류 — 로컬 store 가 SoT 로 유지(작성·표시 비차단). 다음 진입에서 재시도.
                if (hydratedForRef.current === userId) hydratedForRef.current = null;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

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
