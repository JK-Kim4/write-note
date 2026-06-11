"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

interface PreferencesState {
    theme: ThemeMode;
    writingMode: WritingMode;
    manuscriptSize: ManuscriptSize;
    setTheme: (theme: ThemeMode) => void;
    setWritingMode: (mode: WritingMode) => void;
    setManuscriptSize: (size: ManuscriptSize) => void;
}

/** 초기 기본값 — 계정 전환 시 이전 계정 값 누수 방지 리셋(PreferencesSync 버그픽스 F)에도 쓴다. */
export const PREFERENCE_DEFAULTS = {
    theme: "system",
    writingMode: "editor",
    manuscriptSize: 400,
} as const satisfies Pick<PreferencesState, "theme" | "writingMode" | "manuscriptSize">;

export const usePreferences = create<PreferencesState>()(
    persist(
        (set) => ({
            ...PREFERENCE_DEFAULTS,
            setTheme: (theme) => set({ theme }),
            setWritingMode: (writingMode) => set({ writingMode }),
            setManuscriptSize: (manuscriptSize) => set({ manuscriptSize }),
        }),
        {
            name: "writenote.preferences.v1",
        },
    ),
);
