"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/auth/guard";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { WorkMiniCard } from "@/components/dashboard/WorkMiniCard";
import { selectDashboard } from "@/lib/dashboardView";
import { toInboxMemoView } from "@/lib/memoView";
import { formatDuration } from "@/lib/progress";
import { useInboxMemos } from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import { useWeeklyTotal } from "@/lib/query/useSessions";

/**
 * 대시보드(작가 홈) — 018 재진입 허브. `/`의 새 내용물(기존 작품 벽은 /library 로 이동).
 * 읽기 전용 + 진입 동작만: ① 인사+날짜 ② 이어서 쓰기(최근작) — ③ 이번 주/④ 작품/⑤ 곁쪽지는 US3~US5.
 */
export default function DashboardPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();
    const cardsQuery = useProjectCards();
    const weeklyQuery = useWeeklyTotal();
    const memosQuery = useInboxMemos();

    // 날짜 등 new Date() 의존 표시는 마운트 후 렌더 — SSR 프리렌더와의 hydration mismatch 회피(research R5).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const { resume, others } = selectDashboard(cardsQuery.data ?? []);
    const dateLabel = mounted
        ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())
        : "";

    // ⑤ 최근 곁쪽지 — 캡처 시각 최신 2장. 보조 맥락이라 조회 실패는 조용한 빈 상태로 격하(전체 차단 X).
    const recentMemos = [...(memosQuery.data ?? [])]
        .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
        .slice(0, 2)
        .map((memo) => toInboxMemoView(memo, new Date()));

    const memoSection = (
        <>
            <p className="dash-label">최근 곁쪽지</p>
            {recentMemos.length === 0 ? (
                <p className="dash-empty">아직 곁쪽지가 없어요</p>
            ) : (
                <div className="dash-memos">
                    {recentMemos.map((memo) => (
                        <button key={memo.id} type="button" className="dash-memo" onClick={() => router.push("/memos")}>
                            <p className="dash-memo__body">{memo.body}</p>
                            <span className="dash-memo__date">{memo.dateLabel}</span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div className="app">
            <Rail />
            <div className="main">
                <Titlebar title="홈" />
                <div className="screen-body screen-body--solo">
                    <div className="screen-main">
                        <div className="dash-wrap">
                            <h1 className="dash-hello">안녕하세요.</h1>
                            <p className="dash-date">{mounted ? `${dateLabel} — 오늘도 곁에 있을게요.` : " "}</p>

                            {(cardsQuery.data === undefined || weeklyQuery.data === undefined) &&
                            !cardsQuery.isError &&
                            !weeklyQuery.isError ? (
                                <div className="projects-skel" aria-hidden="true">
                                    <div className="skel">
                                        <div className="skel__bar" />
                                        <div className="skel__bar" />
                                        <div className="skel__bar" />
                                    </div>
                                </div>
                            ) : cardsQuery.isError || weeklyQuery.isError ? (
                                <div className="projects-error" role="alert">
                                    <span>작업실을 불러오지 못했습니다.</span>
                                    <button
                                        type="button"
                                        className="btn btn--ghost"
                                        onClick={() => {
                                            void cardsQuery.refetch();
                                            void weeklyQuery.refetch();
                                        }}
                                    >
                                        다시 시도
                                    </button>
                                </div>
                            ) : resume === null ? (
                                <section className="welcome" aria-label="작업실 입구">
                                    <span className="welcome__mark" aria-hidden="true" />
                                    <p className="welcome__brand">나래 노트</p>
                                    <h1 className="welcome__title">작업실이 준비됐습니다</h1>
                                    <p className="welcome__sub">
                                        메모와 등장인물, 톤과 목표 분량, 지난 세션의 마지막 한 줄까지 한자리에. 며칠 만에 다시
                                        열어도 작품의 맥락이 그대로 남아, 흐름을 처음부터 되짚지 않아도 됩니다.
                                    </p>
                                    <button type="button" className="btn btn--primary" onClick={() => router.push("/library?new=1")}>
                                        첫 작품 시작하기
                                    </button>
                                </section>
                            ) : (
                                <>
                                    <p className="dash-label">이어서 쓰기</p>
                                    <ResumeCard card={resume} onOpen={() => router.push(`/projects/${resume.id}/write`)} />
                                    {(weeklyQuery.data?.totalDurationMs ?? 0) > 0 && (
                                        <p className="dash-week">
                                            이번 주 집필 시간 · <b>{formatDuration(weeklyQuery.data?.totalDurationMs ?? 0)}</b>
                                        </p>
                                    )}

                                    <p className="dash-label">작품</p>
                                    <div className="works">
                                        {others.map((card) => (
                                            <WorkMiniCard
                                                key={card.id}
                                                card={card}
                                                onOpen={() => router.push(`/projects/${card.id}/write`)}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            className="work-card work-card--new"
                                            onClick={() => router.push("/library?new=1")}
                                        >
                                            + 새 작품
                                        </button>
                                    </div>

                                    {memoSection}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
