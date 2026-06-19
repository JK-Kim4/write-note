"use client";

import "./b.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { logout } from "@/lib/api/auth";
import { useIsPreferencesHydrated } from "@/stores/preferences";
import { getLastProject } from "@/lib/lastProject";
import { projectKeys, useProjectCards } from "@/lib/query/useProjects";
import { documentKeys } from "@/lib/query/useDocument";
import { webElectronApi } from "@/lib/electron-api";
import type { ChapterMeta } from "@/lib/types/domain";
import { useModalDismiss } from "@/lib/useModalDismiss";

/**
 * B타입 디자인 앱 셸 — fable-test 프로토타입 Layout 이식 (디자인 비교용).
 * sticky 헤더(h-14) + 가로 네비. 기존 A 디자인(Rail 셸)과 라우트(`/b`)·스타일 완전 분리,
 * 데이터 레이어(React Query 훅·apiFetch·인증 가드)는 공유한다.
 */

const NAV_ITEMS = [
    { href: "/", label: "홈", exact: true },
    { href: "/library", label: "작품", exact: false },
    { href: "/memos", label: "메모", exact: false },
    { href: "/characters", label: "인물", exact: false },
    { href: "/logs", label: "기록", exact: false },
    { href: "/settings", label: "설정", exact: false },
] as const;

const NAV_ACTIVE_CLASS = "rounded-md bg-terracotta-50 px-3 py-1.5 text-sm font-medium text-terracotta-700";
const NAV_IDLE_CLASS = "rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900";

export default function BLayout({ children }: { children: React.ReactNode }) {
    useAuthGuard("requireAuth");
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [noProjectModalOpen, setNoProjectModalOpen] = useState(false);
    const [loadErrorModalOpen, setLoadErrorModalOpen] = useState(false);
    // 모바일(<md) 햄버거 메뉴 — 데스크탑은 가로 nav, 모바일은 접어 헤더 가로 overflow(왼쪽 슬라이드) 제거(026 US3).
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { data: projectCards, isLoading: isProjectsLoading, isError: isProjectsError } = useProjectCards();
    const noProjectModalRef = useRef<HTMLDivElement>(null);
    const loadErrorModalRef = useRef<HTMLDivElement>(null);

    // persist 스토어 수화 완료 전 셸/children 렌더 보류 — SSR hydration mismatch 방지.
    const hydrated = useIsPreferencesHydrated();

    // 라우트 이동 시 모바일 메뉴 닫기(Link 네비게이션 후 열린 채 남지 않게).
    useEffect(() => setMobileMenuOpen(false), [pathname]);

    // 집필 진입 대상(최근 연 작품 → 최근 작품) 해석 — handleWriteClick 의 분기와 동일 우선순위.
    const resolveStudioTarget = (): number | null => {
        const last = getLastProject();
        if (last != null && (isProjectsLoading || projectCards?.some((c) => c.id === last))) return last;
        if (projectCards && projectCards.length > 0) return projectCards[0].id;
        return null;
    };

    // 집필 진입 지연 완화 — 버튼 hover/focus(클릭 의도) 시점에 라우트와 데이터를 미리 로드.
    // 핵심: 집필 버튼은 router.push(명령형)라 Next 가 라우트를 자동 prefetch 하지 않아,
    // 클릭 시 동적 라우트(/works/[id]) JS청크+RSC 를 그제서야 받아 ~1초 멈췄다 전환됐다.
    // router.prefetch 로 라우트 자체를 데우고, queryClient 로 2파 워터폴(작품+챕터 → 본문) 데이터를 데운다.
    // prefetchQuery 는 staleTime(60s) 내면 재요청하지 않고 에러는 삼킨다(부작용 없음).
    const prefetchStudio = (id: number) => {
        if (!Number.isFinite(id) || id <= 0) return;
        router.prefetch(`/works/${id}`); // Next 라우트(청크+RSC) 데우기 — 전환 멈춤 제거
        void queryClient.prefetchQuery({ queryKey: projectKeys.detail(id), queryFn: () => webElectronApi.projects.get(id) });
        void queryClient
            .prefetchQuery({ queryKey: documentKeys.chapters(id), queryFn: () => webElectronApi.documents.list(id) })
            .then(() => {
                const chapters = queryClient.getQueryData<ChapterMeta[]>(documentKeys.chapters(id));
                if (!chapters || chapters.length === 0) return;
                // currentChapterId 기본 규칙과 동일: 가장 최근 수정 챕터의 본문을 미리 로드.
                const latest = chapters.reduce((a, c) => (c.updatedAt > a.updatedAt ? c : a));
                void queryClient.prefetchQuery({
                    queryKey: documentKeys.chapter(latest.id),
                    queryFn: () => webElectronApi.documents.get(latest.id),
                });
            });
    };

    // "집필" 진입 — 마지막으로 연 작품(존재 시)→최근 작품→작품 0개면 안내 모달. 데스크탑 nav·모바일 메뉴 공용.
    const handleWriteClick = () => {
        const last = getLastProject();
        // 유효 last id 가 있으면 로딩 중이어도 그 작품으로 진입(존재 검증은 /works/[id] 페이지가 수행).
        if (last != null && (isProjectsLoading || projectCards?.some((c) => c.id === last))) {
            router.push(`/works/${last}`);
            return;
        }
        // 연 적 없거나 그 작품이 삭제됐어도, 작품이 있으면 가장 최근 작품으로.
        if (projectCards && projectCards.length > 0) {
            router.push(`/works/${projectCards[0].id}`);
            return;
        }
        // 조회 실패 — 거짓 빈 상태 대신 에러 안내.
        if (isProjectsError) {
            setLoadErrorModalOpen(true);
            return;
        }
        // last id 없는 로딩 중이면 거짓 모달 방지 위해 작품 목록으로.
        if (isProjectsLoading || projectCards === undefined) {
            router.push("/library");
            return;
        }
        // 로딩 성공 + 0개 → 안내 모달.
        setNoProjectModalOpen(true);
    };

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

    // 안내·에러 모달 ESC 닫기 + focus trap + 배경 스크롤 잠금.
    useModalDismiss(noProjectModalRef, noProjectModalOpen, () => setNoProjectModalOpen(false));
    useModalDismiss(loadErrorModalRef, loadErrorModalOpen, () => setLoadErrorModalOpen(false));

    // 미수화(persist 스토어 복원 전) — 셸/children 렌더 보류.
    // 모든 훅 호출은 이 가드보다 위에 있어 Hooks 규칙 위반 없음.
    if (!hydrated) return null;

    return (
        <div className="flex-1 bg-gray-50 font-sans text-gray-900 antialiased">
            {/* 키보드 사용자용 본문 바로가기 — 평소 숨김, 포커스 시 노출(WCAG 2.4.1). */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-terracotta-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
            >
                본문으로 건너뛰기
            </a>
            <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
                    <Link href="/" aria-label="소설빙 홈" className="shrink-0">
                        <span
                            role="img"
                            aria-label="소설빙"
                            className="block"
                            style={{
                                width: "112px",
                                height: "32px",
                                background: "url('/soseolbing-logo.png') left center / contain no-repeat",
                            }}
                        />
                    </Link>
                    <nav className="hidden flex-1 items-center gap-1 md:flex">
                        {NAV_ITEMS.map((item, i) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <span key={item.href} className="contents">
                                    <Link href={item.href} className={isActive ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS}>
                                        {item.label}
                                    </Link>
                                    {/* 집필 — 마지막으로 연 작품(존재 시)→최근 작품→작품 0개면 안내 모달. "연 적 없음"이 아니라 "작품 없음"일 때만 모달. */}
                                    {i === 0 && (
                                        <button
                                            type="button"
                                            onMouseEnter={() => {
                                                const t = resolveStudioTarget();
                                                if (t != null) prefetchStudio(t);
                                            }}
                                            onFocus={() => {
                                                const t = resolveStudioTarget();
                                                if (t != null) prefetchStudio(t);
                                            }}
                                            onClick={handleWriteClick}
                                            className={`${pathname.startsWith("/works") ? NAV_ACTIVE_CLASS : NAV_IDLE_CLASS} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1`}
                                        >
                                            집필
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </nav>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="hidden rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 md:block"
                    >
                        로그아웃
                    </button>
                    {/* 모바일 햄버거(<md) — 데스크탑 가로 nav 를 접어 헤더 가로 overflow(왼쪽 슬라이드) 제거(026 US3). */}
                    <button
                        type="button"
                        aria-label="메뉴"
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen((o) => !o)}
                        className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1 md:hidden"
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
                    <nav className="flex flex-col gap-0.5 border-t border-gray-200 bg-white px-4 py-2 md:hidden">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`rounded-md px-3 py-2 text-sm ${isActive ? "bg-terracotta-50 font-medium text-terracotta-700" : "text-gray-700 hover:bg-gray-50"}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                handleWriteClick();
                            }}
                            className={`rounded-md px-3 py-2 text-left text-sm ${pathname.startsWith("/works") ? "bg-terracotta-50 font-medium text-terracotta-700" : "text-gray-700 hover:bg-gray-50"}`}
                        >
                            집필
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                            type="button"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            로그아웃
                        </button>
                    </nav>
                )}
            </header>
            <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">{children}</main>

            {noProjectModalOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => setNoProjectModalOpen(false)}
                >
                    <div
                        ref={noProjectModalRef}
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
                            새 작품을 만들어 집필을 시작해 보세요.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    router.push("/library");
                                    setNoProjectModalOpen(false);
                                }}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                작품 목록
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    // 작품 목록으로 이동하며 생성 모달 자동 오픈(?new=1) — b/library 페이지가 파라미터를 읽어 연다.
                                    router.push("/library?new=1");
                                    setNoProjectModalOpen(false);
                                }}
                                className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                            >
                                새 작품 만들기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loadErrorModalOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => setLoadErrorModalOpen(false)}
                >
                    <div
                        ref={loadErrorModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="작품 목록을 불러오지 못했어요"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <div className="flex items-start justify-between">
                            <h2 className="text-lg font-bold text-gray-900">작품 목록을 불러오지 못했어요</h2>
                            <button
                                type="button"
                                aria-label="닫기"
                                onClick={() => setLoadErrorModalOpen(false)}
                                className="ml-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">연결을 확인한 뒤 다시 시도해 주세요.</p>
                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    router.push("/library");
                                    setLoadErrorModalOpen(false);
                                }}
                                className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
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
