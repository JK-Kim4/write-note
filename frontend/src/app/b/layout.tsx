"use client";

import "./b.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { logout } from "@/lib/api/auth";
import { usePreferences, useIsPreferencesHydrated } from "@/stores/preferences";
import { getLastProject } from "@/lib/lastProject";

/**
 * B타입 디자인 앱 셸 — fable-test 프로토타입 Layout 이식 (디자인 비교용).
 * sticky 헤더(h-14) + 가로 네비. 기존 A 디자인(Rail 셸)과 라우트(`/b`)·스타일 완전 분리,
 * 데이터 레이어(React Query 훅·apiFetch·인증 가드)는 공유한다.
 */

const NAV_ITEMS = [
    { href: "/b", label: "작품", exact: true },
    { href: "/b/memos", label: "메모", exact: false },
    { href: "/b/characters", label: "인물", exact: false },
    { href: "/b/logs", label: "기록", exact: false },
    { href: "/b/settings", label: "설정", exact: false },
] as const;

const NAV_ACTIVE_CLASS = "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700";
const NAV_IDLE_CLASS = "rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900";

export default function BLayout({ children }: { children: React.ReactNode }) {
    useAuthGuard("requireAuth");
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [noProjectModalOpen, setNoProjectModalOpen] = useState(false);

    // 완전 전환: 기본 디자인을 고른 사용자가 `/b`로 들어오면 기본 트리(`/`)로 보낸다.
    // hydration 완료 후에만 — 그 전엔 design 이 기본값("default")이라 B 사용자도 오판 리다이렉트된다.
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();
    useEffect(() => {
        if (hydrated && design === "default") router.replace("/");
    }, [hydrated, design, router]);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await logout();
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.replace("/auth/login");
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
            <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
                    <Link href="/b" className="text-base font-bold text-gray-900">
                        글쓰기
                        <span className="ml-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            B
                        </span>
                    </Link>
                    <nav className="flex flex-1 items-center gap-1">
                        {NAV_ITEMS.map((item, i) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <span key={item.href} className="contents">
                                    <Link href={item.href} className={isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS}>
                                        {item.label}
                                    </Link>
                                    {/* 집필 — 마지막으로 연 작품의 집필 화면으로(없으면 작품 목록). A Rail 과 동일 동작. */}
                                    {i === 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const last = getLastProject();
                                                if (last != null) {
                                                    router.push(`/b/works/${last}`);
                                                } else {
                                                    setNoProjectModalOpen(true);
                                                }
                                            }}
                                            className={
                                                pathname.startsWith("/b/works") ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS
                                            }
                                        >
                                            집필
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </nav>
                    <Link href="/" className="text-xs text-gray-400 hover:text-indigo-600">
                        기존 디자인으로
                    </Link>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                        로그아웃
                    </button>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

            {noProjectModalOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => setNoProjectModalOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="아직 펼친 작품이 없어요"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <div className="flex items-start justify-between">
                            <h2 className="text-lg font-bold text-gray-900">아직 펼친 작품이 없어요</h2>
                            <button
                                type="button"
                                aria-label="닫기"
                                onClick={() => setNoProjectModalOpen(false)}
                                className="ml-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            작품을 먼저 선택하거나 새로 만들어 주세요.
                        </p>
                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    router.push("/b");
                                    setNoProjectModalOpen(false);
                                }}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                                작품 목록으로 가기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
