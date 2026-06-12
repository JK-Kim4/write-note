"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import {
    usePreferences,
    DESIGN_HOME,
    type DesignVariant,
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

const DESIGN_OPTIONS: { value: DesignVariant; label: string; description: string }[] = [
    { value: "default", label: "기본 디자인", description: "기존 나래 노트 화면" },
    { value: "b", label: "B타입 디자인", description: "지금 보고 있는 B 레이아웃" },
];

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string; description: string }[] = [
    { value: "A4", label: "A4", description: "210×297mm — 일반 원고지 (기본)" },
    { value: "A3", label: "A3", description: "297×420mm — 넓은 원고지" },
    { value: "A2", label: "A2", description: "420×594mm — 대형 원고지" },
    { value: "B4", label: "B4", description: "257×364mm — JIS B4 규격" },
];

export default function BSettingsPage() {
    const router = useRouter();
    const { theme, setTheme, design, setDesign, paperSize, setPaperSize } = usePreferences();
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });

    // 디자인 선택 = 화면 한 벌 전환. 선택 즉시 해당 트리 홈으로 이동(완전 전환) + localStorage 기억.
    const handleSelectDesign = (next: DesignVariant) => {
        setDesign(next);
        router.push(DESIGN_HOME[next]);
    };

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-xl font-bold">설정</h1>

            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">디자인</h2>
                <p className="mt-0.5 text-xs text-gray-400">화면 디자인 한 벌을 고릅니다. 선택 즉시 전환됩니다.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {DESIGN_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelectDesign(option.value)}
                            className={
                                design === option.value
                                    ? "rounded-md border border-indigo-500 bg-indigo-50 px-3 py-2.5 text-left"
                                    : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50"
                            }
                        >
                            <span
                                className={
                                    design === option.value
                                        ? "block text-sm font-medium text-indigo-700"
                                        : "block text-sm font-medium text-gray-700"
                                }
                            >
                                {option.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">용지 크기</h2>
                <p className="mt-0.5 text-xs text-gray-400">B 집필실 본문의 용지 크기를 고릅니다. 선택 즉시 반영됩니다.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {PAPER_SIZE_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setPaperSize(option.value)}
                            className={
                                paperSize === option.value
                                    ? "rounded-md border border-indigo-500 bg-indigo-50 px-3 py-2.5 text-left"
                                    : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50"
                            }
                        >
                            <span
                                className={
                                    paperSize === option.value
                                        ? "block text-sm font-medium text-indigo-700"
                                        : "block text-sm font-medium text-gray-700"
                                }
                            >
                                {option.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">테마</h2>
                <p className="mt-0.5 text-xs text-gray-400">기존 디자인 화면에 적용됩니다. B 디자인은 라이트 고정.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setTheme(option.value)}
                            className={
                                theme === option.value
                                    ? "rounded-md border border-indigo-500 bg-indigo-50 px-3 py-2.5 text-left"
                                    : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50"
                            }
                        >
                            <span
                                className={
                                    theme === option.value
                                        ? "block text-sm font-medium text-indigo-700"
                                        : "block text-sm font-medium text-gray-700"
                                }
                            >
                                {option.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">계정</h2>
                {meQuery.isLoading ? (
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
                        <div className="flex justify-between">
                            <dt className="text-gray-500">모바일 캡처 토큰</dt>
                            <dd className="text-gray-900">{meQuery.data.activeApiTokenCount}개 활성</dd>
                        </div>
                    </dl>
                ) : (
                    <p className="mt-3 text-sm text-gray-500">계정 정보를 불러올 수 없습니다.</p>
                )}
                <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
                    모바일 캡처 토큰 발급·해지와 카카오 연결 관리는 기존 디자인의 설정 화면에서 할 수 있습니다.
                </p>
            </section>
        </div>
    );
}
