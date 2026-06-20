"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useProjectCards } from "@/lib/query/useProjects";
import { selectDashboard, weekDayRanges } from "@/lib/dashboardView";
import { useWeeklyByDay } from "@/lib/query/useSessions";
import { useInboxMemos } from "@/lib/query/useMemos";
import { toInboxMemoView } from "@/lib/memoView";
import { QuickCapture } from "@/components/QuickCapture";
import { BResumeCard } from "@/components/b/dashboard/BResumeCard";
import { BWorkMiniCard } from "@/components/b/dashboard/BWorkMiniCard";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { BRhythmCard } from "@/components/b/dashboard/BRhythmCard";
import { BTodayGauge } from "@/components/b/dashboard/BTodayGauge";
import { BMemoStrip } from "@/components/b/dashboard/BMemoStrip";
import { usePreferences } from "@/stores/preferences";
import { LITERARY_QUOTES, pickRandom } from "@/lib/literaryQuotes";

export default function BDashboardPage() {
    const router = useRouter();
    const cardsQuery = useProjectCards();
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    const { resume, others } = selectDashboard(cardsQuery.data ?? []);
    const weeklyQuery = useWeeklyByDay();
    const now = new Date();
    const todayIndex = weekDayRanges(now).findIndex((r) => r.isToday);
    const todayDateLabel = `${now.getMonth() + 1}/${now.getDate()}`;
    const dailyGoalMinutes = usePreferences((s) => s.dailyGoalMinutes);
    const todayMs = weeklyQuery.data?.dayMs[todayIndex] ?? 0;
    const memosQuery = useInboxMemos();
    const [captureOpen, setCaptureOpen] = useState(false);
    const [memoDrawerOpen, setMemoDrawerOpen] = useState(false);
    // 방문(마운트)마다 무작위 1구절 — mounted 가드로만 표시해 SSR 하이드레이션 불일치를 피한다(028 US3).
    const [quote] = useState(() => pickRandom(LITERARY_QUOTES));

    // 메모 drawer — 키보드 사용자가 ESC 로 닫을 수 있도록(works/[id] 패턴 정합).
    useEffect(() => {
        if (!memoDrawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMemoDrawerOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [memoDrawerOpen]);

    const dateLabel = mounted
        ? new Intl.DateTimeFormat("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
          }).format(new Date())
        : "";

    // 최근 메모 3장 — 보조 맥락이라 조회 실패는 조용한 빈 상태로 격하(전체 차단 X).
    const recentMemos = [...(memosQuery.data ?? [])]
        .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
        .slice(0, 3)
        .map((m) => {
            const v = toInboxMemoView(m, new Date());
            return { id: v.id, body: v.body, dateLabel: v.dateLabel };
        });

    return (
        <div>
            <OnboardingTour />
            <h1 className="text-xl font-bold text-gray-900">
                {mounted && quote ? (
                    <>
                        <span className="italic font-semibold">“{quote.text}”</span>
                        <span className="ml-2 align-baseline text-sm font-normal not-italic text-gray-400">
                            — {quote.author}
                        </span>
                    </>
                ) : (
                    "안녕하세요."
                )}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
                {mounted ? (quote ? dateLabel : `${dateLabel} — 오늘도 곁에 있을게요.`) : " "}
            </p>

            {cardsQuery.data === undefined && !cardsQuery.isError ? (
                <p className="mt-6 text-sm text-gray-400">불러오는 중…</p>
            ) : cardsQuery.isError ? (
                <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                    작업실을 불러오지 못했습니다.
                    <button
                        type="button"
                        className="ml-2 underline"
                        aria-label="작업실 불러오기 다시 시도"
                        onClick={() => void cardsQuery.refetch()}
                    >
                        다시 시도
                    </button>
                </div>
            ) : resume === null ? (
                <section className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center">
                    <h2 className="text-lg font-bold text-gray-900">작업실이 준비됐습니다</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        메모와 등장인물, 지난 세션의 마지막 한 줄까지 한자리에.
                    </p>
                    <button
                        type="button"
                        data-tour="new-work"
                        className="mt-4 rounded-md bg-terracotta-600 px-4 py-2 text-sm text-white hover:bg-terracotta-700"
                        onClick={() => router.push("/library?new=1")}
                    >
                        첫 작품 시작하기
                    </button>
                </section>
            ) : (
                <div className="mt-6">
                    {/* 상단 풀폭: 이어서쓰기 */}
                    <BResumeCard card={resume} onOpen={() => router.push(`/works/${resume.id}`)} />

                    {/* 880px 미만: 메모 drawer 토글 버튼 */}
                    <button
                        type="button"
                        onClick={() => setMemoDrawerOpen(true)}
                        className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 py-2 text-xs text-amber-700 min-[880px]:hidden"
                    >
                        메모 보기
                    </button>

                    {/* 2컬럼: 좌=작품미니카드+리듬 / 우=메모(상시) */}
                    <div className="mt-4 grid gap-4 min-[880px]:grid-cols-[1fr_320px]">
                        {/* 좌 컬럼 */}
                        <div className="flex flex-col gap-4">
                            {others.length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {others.map((c) => (
                                        <BWorkMiniCard
                                            key={c.id}
                                            card={c}
                                            onOpen={() => router.push(`/works/${c.id}`)}
                                        />
                                    ))}
                                </div>
                            )}
                            {/* 오늘 작업(게이지) : 집필 리듬 ≈ 2:8 한 행(좁은 화면은 세로 적층) */}
                            <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-[minmax(200px,2fr)_8fr] min-[640px]:items-stretch">
                                <BTodayGauge todayMs={todayMs} goalMinutes={dailyGoalMinutes} />
                                <BRhythmCard
                                    dayMs={weeklyQuery.data?.dayMs ?? [0, 0, 0, 0, 0, 0, 0]}
                                    todayIndex={todayIndex}
                                    todayDateLabel={todayDateLabel}
                                    cards={cardsQuery.data ?? []}
                                />
                            </div>
                        </div>

                        {/* 우 컬럼: 메모 패널 상시(≥880px) */}
                        <div className="hidden min-[880px]:block">
                            <BMemoStrip
                                memos={recentMemos}
                                onNew={() => setCaptureOpen(true)}
                                onOpenAll={() => router.push("/memos")}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 880px 미만 메모 drawer 백드롭 */}
            {memoDrawerOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-gray-900/40 min-[880px]:hidden"
                    onClick={() => setMemoDrawerOpen(false)}
                />
            )}

            {/* 880px 미만 메모 drawer */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="메모"
                inert={!memoDrawerOpen || undefined}
                className={`fixed inset-y-0 right-0 z-30 flex w-80 flex-col overflow-hidden bg-white shadow-xl transition-transform duration-200 min-[880px]:hidden ${
                    memoDrawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">메모</span>
                    <button
                        type="button"
                        aria-label="메모 패널 닫기"
                        onClick={() => setMemoDrawerOpen(false)}
                        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    <BMemoStrip
                        memos={recentMemos}
                        onNew={() => {
                            setMemoDrawerOpen(false);
                            setCaptureOpen(true);
                        }}
                        onOpenAll={() => {
                            setMemoDrawerOpen(false);
                            router.push("/memos");
                        }}
                    />
                </div>
            </div>

            {captureOpen && (
                <QuickCapture
                    activeProjectId={null}
                    onClose={() => setCaptureOpen(false)}
                    onCaptured={() => void memosQuery.refetch()}
                />
            )}
        </div>
    );
}
