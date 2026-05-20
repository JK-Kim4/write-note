"use client";

import { useEffect } from "react";
import { usePreferences, type ThemeMode } from "@/stores/preferences";

/**
 * ThemeToggle — 라이트 / 다크 / 시스템 따라가기 3 모드.
 *
 * Spec reference: spec.md §FR-013/014/015 + research.md §"다크 모드 mechanism"
 * Source: DESIGN.md §6 다크 모드 전 앱 — 전 화면 일관 적용.
 *
 * mechanism (직접 구현 우선):
 * - preferences.theme 갱신 → useEffect 가 :root.dark 클래스 toggle
 * - theme === 'system' → prefers-color-scheme MediaQueryList 구독 + OS 변경 자동 따라가기
 */

const MODES: ThemeMode[] = ["light", "dark", "system"];
const LABELS: Record<ThemeMode, string> = {
    light: "라이트",
    dark: "다크",
    system: "시스템",
};

const applyDarkClass = (isDark: boolean): void => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", isDark);
};

const resolveDark = (theme: ThemeMode): boolean => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export function useThemeEffect(): void {
    const theme = usePreferences((s) => s.theme);
    useEffect(() => {
        applyDarkClass(resolveDark(theme));
        if (theme !== "system") return;
        if (typeof window === "undefined") return;
        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => applyDarkClass(mql.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [theme]);
}

export function ThemeToggle() {
    const theme = usePreferences((s) => s.theme);
    const setTheme = usePreferences((s) => s.setTheme);
    useThemeEffect();

    return (
        <div
            role="radiogroup"
            aria-label="테마"
            className="inline-flex rounded-button-pill p-1 gap-1"
            style={{
                backgroundColor: "var(--w-parchment)",
                border: "1px solid var(--w-hairline)",
            }}
        >
            {MODES.map((mode) => {
                const active = theme === mode;
                return (
                    <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTheme(mode)}
                        className="px-3 py-1 rounded-button-pill text-sm font-semibold transition-colors"
                        style={{
                            backgroundColor: active ? "var(--w-ink)" : "transparent",
                            color: active ? "var(--w-canvas)" : "var(--w-ink)",
                        }}
                    >
                        {LABELS[mode]}
                    </button>
                );
            })}
        </div>
    );
}
