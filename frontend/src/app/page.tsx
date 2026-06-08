"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/api/projects";
import { useAuthGuard } from "@/lib/auth/guard";
import { EmptyHero } from "@/components/ui/EmptyHero";
import { HintCard } from "@/components/ui/HintCard";
import { TopBar } from "@/components/shell/TopBar";
import { ProgressRing } from "@/components/shell/ProgressRing";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/**
 * Home page — 동적 변형 (프로젝트 0 → H0, 1+ → 일반 홈).
 *
 * Spec reference: contracts/route-surfaces.md §2-1 + Clarification §Q4 + FR-005
 */

const PHONE_ICON = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="6" y="2" width="12" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
);

const KEYBOARD_ICON = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export default function HomePage() {
    useAuthGuard("requireAuth");
    const projectsQuery = useQuery({
        queryKey: ["projects", { page: 0, size: 20 }],
        queryFn: () => listProjects({ page: 0, size: 20, sort: "updatedAt,desc" }),
        retry: false,
    });

    const isEmpty =
        !projectsQuery.isLoading &&
        !projectsQuery.isError &&
        projectsQuery.data?.totalElements === 0;

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar
                title="write-note"
                actions={<ThemeToggle />}
            />
            {projectsQuery.isError ? (
                <EmptyHero
                    title="프로젝트를 불러오지 못했습니다"
                    lede="네트워크 또는 세션 문제일 수 있습니다. 다시 시도해 주세요."
                    cta={
                        <button
                            type="button"
                            onClick={() => projectsQuery.refetch()}
                            className="px-8 py-4 rounded-card-mode font-semibold"
                            style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                        >
                            다시 시도
                        </button>
                    }
                />
            ) : isEmpty ? (
                <EmptyHero
                    title="환영합니다"
                    lede="첫 프로젝트를 만들어 작가의 작업공간을 시작해 보세요."
                    cta={
                        <Link
                            href="/projects/new"
                            className="px-8 py-4 rounded-card-mode font-semibold"
                            style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                        >
                            + 첫 프로젝트 만들기
                        </Link>
                    }
                    hints={
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-4">
                            <HintCard
                                icon={PHONE_ICON}
                                title="모바일에서 메모"
                                description="iOS Shortcut 으로 영감을 즉시 캡처합니다."
                            />
                            <HintCard
                                icon={KEYBOARD_ICON}
                                title="⌘ + N 빠른 입력"
                                description="데스크탑에서 어느 화면이든 단축키로 메모합니다."
                            />
                        </div>
                    }
                />
            ) : (
                <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12">
                    <section className="flex items-center justify-between mb-8">
                        <h1
                            className="font-display font-semibold"
                            style={{ fontSize: "28px", color: "var(--w-ink)" }}
                        >
                            프로젝트
                        </h1>
                        <div className="flex items-center gap-3">
                            <Link
                                href="/projects/new"
                                className="text-sm px-3 py-2 rounded-button-pill font-semibold"
                                style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                            >
                                + 새 프로젝트
                            </Link>
                            <Link
                                href="/memos"
                                className="text-sm px-3 py-2 rounded-button-utility"
                                style={{ color: "var(--w-accent)" }}
                            >
                                메모 inbox →
                            </Link>
                        </div>
                    </section>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(projectsQuery.data?.content ?? []).map((p) => (
                            <article
                                key={p.id}
                                className="p-6 rounded-card-project"
                                style={{
                                    backgroundColor: "var(--w-canvas)",
                                    border: "1px solid var(--w-hairline)",
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h2
                                        className="font-display font-semibold"
                                        style={{ fontSize: "20px", color: "var(--w-ink)" }}
                                    >
                                        {p.title}
                                    </h2>
                                    <ProgressRing value={0} label="0%" />
                                </div>
                                <p
                                    style={{
                                        color: "var(--w-ink)",
                                        opacity: 0.6,
                                        fontSize: "14px",
                                        fontStyle: "italic",
                                    }}
                                >
                                    {/* 지난 세션 hero 인용 placeholder — Week 5 SessionNote 합류 */}
                                    지난 세션 인용은 Week 5 에 합류 예정
                                </p>
                            </article>
                        ))}
                    </div>
                </main>
            )}
        </div>
    );
}
