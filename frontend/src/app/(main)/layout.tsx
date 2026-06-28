"use client";

import "./b.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Home, Megaphone, Network, Share2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { logout } from "@/lib/api/auth";
import { useIsPreferencesHydrated } from "@/stores/preferences";

/**
 * B타입 디자인 앱 셸 — fable-test 프로토타입 Layout 이식 (디자인 비교용).
 * sticky 헤더(h-14) + 가로 네비. 기존 A 디자인(Rail 셸)과 라우트(`/b`)·스타일 완전 분리,
 * 데이터 레이어(React Query 훅·apiFetch·인증 가드)는 공유한다.
 * 집필 진입은 별도 nav 메뉴 없이 "작품"(/library)에서 작품을 열어 들어간다.
 */

// 044 보드 중심 전환 — 메모·인물 메뉴 폐기(보드로 통합). 데이터·iOS 캡처·BE 는 보존.
const NAV_ITEMS = [
    { href: "/", label: "홈", exact: true, Icon: Home },
    { href: "/library", label: "작품", exact: false, dataTour: "nav-works", Icon: BookOpen },
    { href: "/boards", label: "보드", exact: false, dataTour: "nav-boards", Icon: Network },
    { href: "/logs", label: "기록", exact: false, Icon: Clock },
    // 047 — 공유를 마이페이지 하위에서 헤더 최상위로(접근성). 핵심 기능이라 부차적인 공지보다 앞(사용자 승인 트레이드오프).
    { href: "/shares", label: "공유", exact: false, Icon: Share2 },
    { href: "/notice", label: "공지", exact: false, Icon: Megaphone },
] as const;

// 메뉴 칩 — 단색 라인 아이콘(lucide) + 라벨. 평상시 회색, 선택은 테라코타(주 액센트),
// hover 는 물방울 청록(teal, 로고 빗방울 모티프) — product 절제 원칙: 진한 색은 선택/hover 에만.
const NAV_CHIP = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors";
const NAV_ACTIVE_CLASS = `${NAV_CHIP} bg-accent-soft font-medium text-accent-text`;
const NAV_IDLE_CLASS = `${NAV_CHIP} text-muted-strong hover:bg-teal-50 hover:text-teal-800`;

export default function BLayout({ children }: { children: React.ReactNode }) {
    useAuthGuard("requireAuth");
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    // 모바일(<md) 햄버거 메뉴 — 데스크탑은 가로 nav, 모바일은 접어 헤더 가로 overflow(왼쪽 슬라이드) 제거(026 US3).
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // persist 스토어 수화 완료 전 셸/children 렌더 보류 — SSR hydration mismatch 방지.
    const hydrated = useIsPreferencesHydrated();

    // 라우트 이동 시 모바일 메뉴 닫기(Link 네비게이션 후 열린 채 남지 않게).
    useEffect(() => setMobileMenuOpen(false), [pathname]);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await logout();
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.replace("/auth/login");
        } catch {
            // 로그아웃 실패는 대개 세션이 이미 만료된 경우 — 로컬 인증 캐시를 비우고 로그인으로 보내 멈춤을 막는다.
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.replace("/auth/login");
        } finally {
            setIsLoggingOut(false);
        }
    };

    // 미수화(persist 스토어 복원 전) — 셸/children 렌더 보류.
    // 모든 훅 호출은 이 가드보다 위에 있어 Hooks 규칙 위반 없음.
    if (!hydrated) return null;

    return (
        <div className="flex-1 bg-surface-2 font-sans text-ink antialiased">
            {/* 키보드 사용자용 본문 바로가기 — 평소 숨김, 포커스 시 노출(WCAG 2.4.1). */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
            >
                본문으로 건너뛰기
            </a>
            <header className="sticky top-0 z-20 border-b border-border bg-surface">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
                    <Link href="/" aria-label="소설비 홈" className="shrink-0">
                        <span
                            role="img"
                            aria-label="소설비"
                            className="block"
                            style={{
                                width: "132px",
                                height: "48px",
                                background: "url('/soseolbi-logo.png') left center / contain no-repeat",
                            }}
                        />
                    </Link>
                    <nav className="hidden flex-1 items-center gap-1 md:flex">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    data-tour={"dataTour" in item ? item.dataTour : undefined}
                                    className={isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS}
                                >
                                    <item.Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    {/* 마이페이지(계정·신원) — 앱 설정(/settings)과 분리된 계정 영역 진입점. */}
                    <Link
                        href="/mypage"
                        className="hidden rounded-md px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 md:block"
                    >
                        마이페이지
                    </Link>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="hidden rounded-md border border-border-strong px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 md:block"
                    >
                        로그아웃
                    </button>
                    {/* 모바일 햄버거(<md) — 데스크탑 가로 nav 를 접어 헤더 가로 overflow(왼쪽 슬라이드) 제거(026 US3). */}
                    <button
                        type="button"
                        aria-label="메뉴"
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-muted-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 md:hidden"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                            {mobileMenuOpen ? (
                                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                            ) : (
                                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
                            )}
                        </svg>
                    </button>
                </div>
                {/* 모바일 메뉴 패널 — sticky 헤더 내부(스크롤 시 함께 고정). md 이상에선 숨김. */}
                {mobileMenuOpen && (
                    <nav className="flex flex-col gap-0.5 border-t border-border bg-surface px-4 py-2 md:hidden">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent-soft font-medium text-accent-text" : "text-ink-2 hover:bg-teal-50 hover:text-teal-800"}`}
                                >
                                    <item.Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                                    {item.label}
                                </Link>
                            );
                        })}
                        <div className="my-1 border-t border-border" />
                        <Link
                            href="/mypage"
                            onClick={() => setMobileMenuOpen(false)}
                            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-2 hover:bg-surface-2"
                        >
                            마이페이지
                        </Link>
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="rounded-md px-3 py-2 text-left text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                        >
                            로그아웃
                        </button>
                    </nav>
                )}
            </header>
            <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </div>
    );
}
