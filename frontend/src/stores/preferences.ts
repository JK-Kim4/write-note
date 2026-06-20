"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PaperSize } from "@/components/editor/pageLayout";

/**
 * UI Preferences Store — 사용자의 영속 환경 preference.
 *
 * Spec reference: data-model.md §1 + spec.md §FR-013/014
 * Source of truth: DESIGN.md §7 분리 원칙 — 설정 (영구 환경)
 *
 * 영속 mechanism: localStorage key `writenote.preferences.v1`
 * Version 1 prefix — 후속 phase 에서 schema 추가 시 migration 가능
 */

export type ThemeMode = "light" | "dark" | "system";
export type WritingMode = "manuscript" | "editor";
export type ManuscriptSize = 200 | 400 | 1000;
export type { PaperSize };

/** 일일 작업 목표 시간(분) 허용 이산값 — 백엔드 ALLOWED["dailyGoalMinutes"] 와 정합(028 US2). */
export const DAILY_GOAL_MINUTES = [30, 60, 90, 120, 180, 240, 300] as const;
export type DailyGoalMinutes = (typeof DAILY_GOAL_MINUTES)[number];

interface PreferencesState {
    theme: ThemeMode;
    writingMode: WritingMode;
    manuscriptSize: ManuscriptSize;
    paperSize: PaperSize;
    dailyGoalMinutes: DailyGoalMinutes;
    setTheme: (theme: ThemeMode) => void;
    setWritingMode: (mode: WritingMode) => void;
    setManuscriptSize: (size: ManuscriptSize) => void;
    setPaperSize: (size: PaperSize) => void;
    setDailyGoalMinutes: (minutes: DailyGoalMinutes) => void;
}

/** 초기 기본값 — 계정 전환 시 이전 계정 값 누수 방지 리셋(PreferencesSync 버그픽스 F)에도 쓴다. */
export const PREFERENCE_DEFAULTS = {
    theme: "system",
    writingMode: "editor",
    manuscriptSize: 400,
    paperSize: "A4",
    dailyGoalMinutes: 60,
} as const satisfies Pick<
    PreferencesState,
    "theme" | "writingMode" | "manuscriptSize" | "paperSize" | "dailyGoalMinutes"
>;

export const usePreferences = create<PreferencesState>()(
    persist(
        (set) => ({
            ...PREFERENCE_DEFAULTS,
            setTheme: (theme) => set({ theme }),
            setWritingMode: (writingMode) => set({ writingMode }),
            setManuscriptSize: (manuscriptSize) => set({ manuscriptSize }),
            setPaperSize: (paperSize) => set({ paperSize }),
            setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
        }),
        {
            name: "writenote.preferences.v1",
        },
    ),
);

/**
 * persist 스토어가 localStorage 에서 복원(rehydrate)을 끝냈는지 반환.
 *
 * SSR/첫 클라 렌더 시점엔 design 등 영속값이 아직 기본값이다 — 이 값으로 디자인 가드가
 * 리다이렉트하면 오판(예: B 사용자가 하드 로드 시 잠깐 "default" 로 읽혀 기본 트리로 튕김)이 난다.
 * 따라서 디자인 완전 전환 가드는 본 훅이 true 일 때만 동작해야 한다.
 */
export function useIsPreferencesHydrated(): boolean {
    return useSyncExternalStore(
        (onStoreChange) => usePreferences.persist.onFinishHydration(onStoreChange),
        () => usePreferences.persist.hasHydrated(),
        () => false,
    );
}
