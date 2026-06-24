"use client";

import { type KeyboardEvent } from "react";
import {
    DAILY_GOAL_MINUTES,
    usePreferences,
    useIsPreferencesHydrated,
    type DailyGoalMinutes,
    type ThemeMode,
} from "@/stores/preferences";
import { formatDurationMinutes } from "@/lib/todayGauge";

/**
 * 환경설정 항목 (037) — 테마·일일 작업 목표.
 *
 * "새 작품 기본 용지"는 033 시리즈 종속 전환으로 새 작품 생성에 반영되지 않는 죽은 설정이라 제거함
 * (집필실은 effectivePaperSize 를 사용). preferences.paperSize 스토어 키는 구버전 호환 위해 잔존(별도 정리 대상).
 */
const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
    { value: "light", label: "라이트", description: "항상 밝은 화면" },
    { value: "dark", label: "다크", description: "항상 어두운 화면" },
    { value: "system", label: "시스템", description: "기기 설정을 따름" },
];

/**
 * radiogroup 화살표키 이동(roving tabindex 짝). ArrowDown/Right → 다음, ArrowUp/Left → 이전(순환).
 */
function handleRadioKeyDown<TValue extends string>(
    e: KeyboardEvent<HTMLButtonElement>,
    options: readonly { value: TValue }[],
    current: TValue,
    onSelect: (value: TValue) => void,
): void {
    const isNext = e.key === "ArrowDown" || e.key === "ArrowRight";
    const isPrev = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!isNext && !isPrev) return;
    e.preventDefault();
    const currentIndex = options.findIndex((o) => o.value === current);
    const base = currentIndex === -1 ? 0 : currentIndex;
    const delta = isNext ? 1 : -1;
    const nextIndex = (base + delta + options.length) % options.length;
    const nextValue = options[nextIndex].value;
    onSelect(nextValue);
    const group = e.currentTarget.parentElement;
    const buttons = group?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    buttons?.[nextIndex]?.focus();
}

export function PreferencesSections() {
    const { theme, setTheme, dailyGoalMinutes, setDailyGoalMinutes } = usePreferences();
    const isHydrated = useIsPreferencesHydrated();

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-base font-semibold text-ink">일일 작업 목표</h2>
                <p className="mt-0.5 text-xs text-faint">홈 화면의 &ldquo;오늘 작업&rdquo; 게이지가 이 목표 대비 채워집니다.</p>
                <label htmlFor="daily-goal" className="sr-only">
                    일일 작업 목표 시간
                </label>
                <select
                    id="daily-goal"
                    value={dailyGoalMinutes}
                    disabled={!isHydrated}
                    onChange={(e) => setDailyGoalMinutes(Number(e.target.value) as DailyGoalMinutes)}
                    className="mt-3 w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink-2 disabled:opacity-60"
                >
                    {DAILY_GOAL_MINUTES.map((minutes) => (
                        <option key={minutes} value={minutes}>
                            {formatDurationMinutes(minutes)}
                        </option>
                    ))}
                </select>
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-base font-semibold text-ink">테마</h2>
                <p className="mt-0.5 text-xs text-faint">기존 디자인 화면에 적용됩니다. B 디자인은 라이트 고정.</p>
                <div role="radiogroup" aria-label="테마" aria-busy={!isHydrated} className="mt-3 grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((option) => {
                        const selected = isHydrated && theme === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                tabIndex={!isHydrated ? -1 : theme === option.value ? 0 : -1}
                                disabled={!isHydrated}
                                onClick={() => setTheme(option.value)}
                                onKeyDown={(e) => handleRadioKeyDown(e, THEME_OPTIONS, theme, setTheme)}
                                className={
                                    selected
                                        ? "rounded-md border border-terracotta-500 bg-accent-soft px-3 py-2.5 text-left"
                                        : "rounded-md border border-border-strong px-3 py-2.5 text-left hover:bg-surface-2 disabled:opacity-60 disabled:hover:bg-transparent"
                                }
                            >
                                <span
                                    className={
                                        selected
                                            ? "block text-sm font-medium text-accent-text"
                                            : "block text-sm font-medium text-ink-2"
                                    }
                                >
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-faint">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
