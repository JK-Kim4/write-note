"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/auth/guard";
import { usePreferences, useIsPreferencesHydrated } from "@/stores/preferences";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { QuickCapture } from "@/components/QuickCapture";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { RhythmCard } from "@/components/dashboard/RhythmCard";
import { WorkMiniCard } from "@/components/dashboard/WorkMiniCard";
import { selectDashboard, weekDayRanges } from "@/lib/dashboardView";
import { toInboxMemoView } from "@/lib/memoView";
import { useInboxMemos } from "@/lib/query/useMemos";
import { useProjectCards } from "@/lib/query/useProjects";
import { useWeeklyByDay } from "@/lib/query/useSessions";

/**
 * 대시보드(작가 홈) — 018 재진입 허브, v4 2단(B안).
 * 좌 = 이어서 쓰기 타일 + 작품 미니 카드 2열 / 우 = 집필 리듬 카드(주간·작품별 막대, 좌측 바닥선 정렬)
 * / 하단 전폭 = 최근 곁쪽지 3장 + 새 곁쪽지(빠른 메모 모달). 전부 읽기 전용 + 진입 동작만.
 */
export default function DashboardPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();

    // 완전 전환: B타입을 고른 사용자는 루트로 들어와도 B 트리(`/b`)로 보낸다.
    // hydration 완료 후에만 — localStorage 기반 design 값은 그 전엔 기본값이라 확정 불가.
    const design = usePreferences((state) => state.design);
    const hydrated = useIsPreferencesHydrated();
    useEffect(() => {
        if (hydrated && design === "b") router.replace("/b");
    }, [hydrated, design, router]);

    const cardsQuery = useProjectCards();
    const weeklyQuery = useWeeklyByDay();
    const memosQuery = useInboxMemos();
    const [captureOpen, setCaptureOpen] = useState(false);

    // 날짜 등 new Date() 의존 표시는 클라에서만 렌더 — SSR 프리렌더와의 hydration mismatch 회피(research R5).
    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    const { resume, others } = selectDashboard(cardsQuery.data ?? []);
    const dateLabel = mounted
        ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date())
        : "";
    const todayIndex = weekDayRanges(new Date()).findIndex((r) => r.isToday);

    // 최근 곁쪽지 3장 — 보조 맥락이라 조회 실패는 조용한 빈 상태로 격하(전체 차단 X).
    const recentMemos = [...(memosQuery.data ?? [])]
        .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))
        .slice(0, 3)
        .map((memo) => toInboxMemoView(memo, new Date()));

    const isLoading =
        (cardsQuery.data === undefined || weeklyQuery.data === undefined) && !cardsQuery.isError && !weeklyQuery.isError;

    // hydration 전(디자인 미확정) 또는 B 사용자(곧 /b 로 redirect)면 A 홈을 칠하지 않는다 —
    // 기본화면이 잠깐 노출됐다 전환되는 깜빡임 방지(B layout 의 default 가드와 대칭). 모든 훅 호출 뒤라 Hooks 규칙 위반 없음.
    if (!hydrated || design === "b") return null;

    return (
        <div className="app">
            <Rail />
            <div className="main">
                <Titlebar title="홈" />
                <div className="screen-body screen-body--solo">
                    <div className="screen-main">
                        <div className="dash-wrap">
                            <h1 className="dash-hello">안녕하세요.</h1>
                            <p className="dash-date">{mounted ? `${dateLabel} — 오늘도 곁에 있을게요.` : " "}</p>

                            {isLoading ? (
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
                                    <div className="dash-cols">
                                        <div className="dash-col">
                                            <div className="sec-head">
                                                <p className="dash-label">이어서 쓰기</p>
                                                <button type="button" className="sec-link" onClick={() => router.push("/library")}>
                                                    모든 작품 보기 →
                                                </button>
                                            </div>
                                            <ResumeCard card={resume} onOpen={() => router.push(`/projects/${resume.id}/write`)} />
                                            {others.length > 0 && (
                                                <div className="works">
                                                    {others.map((card) => (
                                                        <WorkMiniCard
                                                            key={card.id}
                                                            card={card}
                                                            onOpen={() => router.push(`/projects/${card.id}/write`)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="dash-col">
                                            <div className="sec-head">
                                                <p className="dash-label">집필 리듬</p>
                                            </div>
                                            <RhythmCard
                                                dayMs={weeklyQuery.data?.dayMs ?? [0, 0, 0, 0, 0, 0, 0]}
                                                todayIndex={todayIndex}
                                                cards={cardsQuery.data ?? []}
                                            />
                                        </div>
                                    </div>

                                    <div className="sec-head">
                                        <p className="dash-label">최근 곁쪽지</p>
                                        <button type="button" className="sec-link" onClick={() => router.push("/memos")}>
                                            모든 곁쪽지 보기 →
                                        </button>
                                    </div>
                                    {recentMemos.length === 0 ? (
                                        <p className="dash-empty">아직 곁쪽지가 없어요</p>
                                    ) : (
                                        <div className="dash-memos">
                                            {recentMemos.map((memo) => (
                                                <button
                                                    key={memo.id}
                                                    type="button"
                                                    className="dash-memo"
                                                    onClick={() => router.push("/memos")}
                                                >
                                                    <p className="dash-memo__body">{memo.body}</p>
                                                    <span className="dash-memo__date">{memo.dateLabel}</span>
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                className="dash-memo dash-memo--new"
                                                onClick={() => setCaptureOpen(true)}
                                            >
                                                <span className="dash-memo--new__plus" aria-hidden="true">
                                                    +
                                                </span>
                                                새 곁쪽지
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {captureOpen && <QuickCapture activeProjectId={null} onClose={() => setCaptureOpen(false)} />}
        </div>
    );
}
