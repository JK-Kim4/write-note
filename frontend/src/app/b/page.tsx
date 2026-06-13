"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useProjectCards } from "@/lib/query/useProjects";
import { selectDashboard, weekDayRanges } from "@/lib/dashboardView";
import { useWeeklyByDay } from "@/lib/query/useSessions";
import { BResumeCard } from "@/components/b/dashboard/BResumeCard";
import { BWorkMiniCard } from "@/components/b/dashboard/BWorkMiniCard";
import { BRhythmCard } from "@/components/b/dashboard/BRhythmCard";

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
    const todayIndex = weekDayRanges(new Date()).findIndex((r) => r.isToday);

    const dateLabel = mounted
        ? new Intl.DateTimeFormat("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
          }).format(new Date())
        : "";

    return (
        <div>
            <h1 className="text-xl font-bold text-gray-900">안녕하세요.</h1>
            <p className="mt-1 text-sm text-gray-500">
                {mounted ? `${dateLabel} — 오늘도 곁에 있을게요.` : " "}
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
                        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                        onClick={() => router.push("/b/library?new=1")}
                    >
                        첫 작품 시작하기
                    </button>
                </section>
            ) : (
                <div className="mt-6">
                    <BResumeCard card={resume} onOpen={() => router.push(`/b/works/${resume.id}`)} />
                    <div className="mt-4 grid gap-4 min-[880px]:grid-cols-[1.4fr_1fr]">
                        <div>
                            {others.length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {others.map((c) => (
                                        <BWorkMiniCard key={c.id} card={c} onOpen={() => router.push(`/b/works/${c.id}`)} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <BRhythmCard
                            dayMs={weeklyQuery.data?.dayMs ?? [0, 0, 0, 0, 0, 0, 0]}
                            todayIndex={todayIndex}
                            cards={cardsQuery.data ?? []}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
