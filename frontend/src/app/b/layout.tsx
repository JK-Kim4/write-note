"use client";

import "./b.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { logout } from "@/lib/api/auth";
import { usePreferences, useIsPreferencesHydrated } from "@/stores/preferences";
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
    { href: "/b", label: "홈", exact: true },
    { href: "/b/library", label: "작품", exact: false },
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
    const [loadErrorModalOpen, setLoadErrorModalOpen] = useState(false);
    const { data: projectCards, isLoading: isProjectsLoading, isError: isProjectsError } = useProjectCards();
    const noProjectModalRef = useRef<HTMLDivElement>(null);
    const loadErrorModalRef = useRef<HTMLDivElement>(null);

    // 완전 전환: 기본 디자인을 고른 사용자가 `/b`로 들어오면 기본 트리(`/`)로 보낸다.
    // hydration 완료 후에만 — 그 전엔 design 이 기본값("default")이라 B 사용자도 오판 리다이렉트된다.
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();
    useEffect(() => {
        if (hydrated && design === "default") router.replace("/");
    }, [hydrated, design, router]);

    // 집필 진입 대상(최근 연 작품 → 최근 작품) 해석 — onClick 의 분기와 동일 우선순위.
    const resolveStudioTarget = (): number | null => {
        const last = getLastProject();
        if (last != null && (isProjectsLoading || projectCards?.some((c) => c.id === last))) return last;
        if (projectCards && projectCards.length > 0) return projectCards[0].id;
        return null;
    };

    // 집필 진입 지연 완화 — 버튼 hover/focus(클릭 의도) 시점에 라우트와 데이터를 미리 로드.
    // 핵심: 집필 버튼은 router.push(명령형)라 Next 가 라우트를 자동 prefetch 하지 않아,
    // 클릭 시 동적 라우트(/b/works/[id]) JS청크+RSC 를 그제서야 받아 ~1초 멈췄다 전환됐다.
    // router.prefetch 로 라우트 자체를 데우고, queryClient 로 2파 워터폴(작품+챕터 → 본문) 데이터를 데운다.
    // prefetchQuery 는 staleTime(60s) 내면 재요청하지 않고 에러는 삼킨다(부작용 없음).
    const prefetchStudio = (id: number) => {
        if (!Number.isFinite(id) || id <= 0) return;
        router.prefetch(`/b/works/${id}`); // Next 라우트(청크+RSC) 데우기 — 전환 멈춤 제거
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

    // 미수화(디자인 미확정) 또는 기본 디자인 사용자 → 셸/children 렌더 보류.
    // 위 useEffect 가 리다이렉트(/)로 보내는 동안 B 헤더·네비·children 이 한 프레임 깜빡이는 것을 막는다.
    // 모든 훅 호출은 이 가드보다 위에 있어 Hooks 규칙 위반 없음.
    if (!hydrated || design === "default") return null;

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
                                            onClick={() => {
                                                const last = getLastProject();
                                                // 유효 last id 가 있으면 로딩 중이어도 그 작품으로 진입(존재 검증은 /b/works/[id] 페이지가 수행).
                                                if (
                                                    last != null &&
                                                    (isProjectsLoading || projectCards?.some((c) => c.id === last))
                                                ) {
                                                    router.push(`/b/works/${last}`);
                                                    return;
                                                }
                                                // 연 적 없거나 그 작품이 삭제됐어도, 작품이 있으면 가장 최근 작품으로.
                                                if (projectCards && projectCards.length > 0) {
                                                    router.push(`/b/works/${projectCards[0].id}`);
                                                    return;
                                                }
                                                // 조회 실패 — 거짓 빈 상태 대신 에러 안내.
                                                if (isProjectsError) {
                                                    setLoadErrorModalOpen(true);
                                                    return;
                                                }
                                                // last id 없는 로딩 중이면 거짓 모달 방지 위해 작품 목록으로.
                                                if (isProjectsLoading || projectCards === undefined) {
                                                    router.push("/b/library");
                                                    return;
                                                }
                                                // 로딩 성공 + 0개 → 안내 모달.
                                                setNoProjectModalOpen(true);
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
                                    router.push("/b/library");
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
                                    router.push("/b/library?new=1");
                                    setNoProjectModalOpen(false);
                                }}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
                                    router.push("/b/library");
                                    setLoadErrorModalOpen(false);
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
