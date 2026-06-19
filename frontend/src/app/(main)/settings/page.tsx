"use client";

import { type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import {
    usePreferences,
    useIsPreferencesHydrated,
    type PaperSize,
    type ThemeMode,
} from "@/stores/preferences";

/**
 * B타입 설정 — fable-test 카드 문법으로 구성한 설정 화면.
 * 테마는 기존 preferences 스토어(A 디자인과 공유) 그대로 — B 화면 자체는 라이트 고정이고
 * 테마 값은 기존(A) 디자인 화면에 적용된다. 계정 정보는 ["auth","me"] 쿼리 재사용.
 */

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
    { value: "light", label: "라이트", description: "항상 밝은 화면" },
    { value: "dark", label: "다크", description: "항상 어두운 화면" },
    { value: "system", label: "시스템", description: "기기 설정을 따름" },
];

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string; description: string }[] = [
    { value: "A4", label: "A4", description: "210×297mm — 일반 원고지 (기본)" },
    { value: "A3", label: "A3", description: "297×420mm — 넓은 원고지" },
    { value: "A2", label: "A2", description: "420×594mm — 대형 원고지" },
    { value: "B4", label: "B4", description: "257×364mm — JIS B4 규격" },
];

/**
 * radiogroup 화살표키 이동(roving tabindex 짝). ArrowDown/Right → 다음, ArrowUp/Left → 이전(순환).
 * 이동과 동시에 선택값을 바꾸고 새 항목 버튼에 focus 를 옮긴다. options 는 value 순서대로 렌더된다는 전제.
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

export default function BSettingsPage() {
    const { theme, setTheme, paperSize, setPaperSize } = usePreferences();
    // 미수화(하드 로드 직후) 동안에는 선택 강조를 보류 — 기본값(A4/시스템)으로 깜빡였다 교정되는 현상 방지.
    const isHydrated = useIsPreferencesHydrated();
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-xl font-bold">설정</h1>

            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">새 작품 기본 용지</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                    새 작품을 만들 때 기본으로 쓸 용지입니다. 작품별 용지는 집필실 좌측 &ldquo;용지&rdquo;에서 바꿀 수 있어요.
                </p>
                <div role="radiogroup" aria-label="새 작품 기본 용지" aria-busy={!isHydrated} className="mt-3 grid grid-cols-2 gap-2">
                    {PAPER_SIZE_OPTIONS.map((option) => {
                        const selected = isHydrated && paperSize === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                tabIndex={!isHydrated ? -1 : paperSize === option.value ? 0 : -1}
                                disabled={!isHydrated}
                                onClick={() => setPaperSize(option.value)}
                                onKeyDown={(e) => handleRadioKeyDown(e, PAPER_SIZE_OPTIONS, paperSize, setPaperSize)}
                                className={
                                    selected
                                        ? "rounded-md border border-terracotta-500 bg-terracotta-50 px-3 py-2.5 text-left"
                                        : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-transparent"
                                }
                            >
                                <span
                                    className={
                                        selected
                                            ? "block text-sm font-medium text-terracotta-700"
                                            : "block text-sm font-medium text-gray-700"
                                    }
                                >
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">테마</h2>
                <p className="mt-0.5 text-xs text-gray-400">기존 디자인 화면에 적용됩니다. B 디자인은 라이트 고정.</p>
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
                                        ? "rounded-md border border-terracotta-500 bg-terracotta-50 px-3 py-2.5 text-left"
                                        : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-transparent"
                                }
                            >
                                <span
                                    className={
                                        selected
                                            ? "block text-sm font-medium text-terracotta-700"
                                            : "block text-sm font-medium text-gray-700"
                                    }
                                >
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">계정</h2>
                {meQuery.isPending ? (
                    <p className="mt-3 text-sm text-gray-400">불러오는 중…</p>
                ) : meQuery.data ? (
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">이메일</dt>
                            <dd className="text-gray-900">{meQuery.data.email}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">카카오 연결</dt>
                            <dd className="text-gray-900">{meQuery.data.kakaoLinked ? "연결됨" : "미연결"}</dd>
                        </div>
                    </dl>
                ) : (
                    <div className="mt-3">
                        <p className="text-sm text-gray-500">계정 정보를 불러올 수 없습니다.</p>
                        <button
                            type="button"
                            onClick={() => meQuery.refetch()}
                            disabled={meQuery.isFetching}
                            className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            다시 시도
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
