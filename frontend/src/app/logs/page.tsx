"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/lib/auth/guard";
import { Rail } from "@/components/workspace/Rail";
import { Titlebar } from "@/components/workspace/Titlebar";
import { LogCard } from "@/components/workspace/LogCard";
import { useLogCards } from "@/lib/query/useLogs";

/**
 * 집필 기록 화면 (015 US3) — desktop LogScreen 1:1 이식. 작품별 진척 카드(최근 기록·누적 작업 시간).
 * desktop 의 "요약" 패널 토글은 패널 내용이 없어(vestigial) 생략 — 카드가 표시값을 모두 담는다.
 */
export default function LogsPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();
    const now = useMemo(() => new Date(), []);
    const cardsQuery = useLogCards();
    const cards = cardsQuery.data ?? [];

    return (
        <div className="app">
            <Rail />
            <div className="main">
                <Titlebar title="기록" />
                <div className="screen-body screen-body--solo">
                    <div className="screen-main">
                        {cardsQuery.isLoading ? (
                            <div className="projects-skel" aria-hidden="true">
                                <div className="skel">
                                    <div className="skel__bar" />
                                    <div className="skel__bar" />
                                    <div className="skel__bar" />
                                </div>
                            </div>
                        ) : cardsQuery.isError ? (
                            <div className="projects-error" role="alert">
                                <span>기록을 불러오지 못했습니다.</span>
                                <button type="button" className="btn btn--ghost" onClick={() => cardsQuery.refetch()}>
                                    다시 시도
                                </button>
                            </div>
                        ) : cards.length === 0 ? (
                            <div className="log-empty">
                                <div className="log-empty__icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4" />
                                        <path d="M3 4v3.5h3.5" />
                                        <path d="M12 8v4l3 2" />
                                    </svg>
                                </div>
                                <h1 className="screen-h1">글쓰기 기록</h1>
                                <p className="log-empty__text">작품을 만들면 진척과 기록이 여기 쌓입니다.</p>
                            </div>
                        ) : (
                            <ul className="log-card-list">
                                {cards.map((card) => (
                                    <li key={card.project.id}>
                                        <LogCard card={card} now={now} onOpenProject={(id) => router.push(`/projects/${id}/write`)} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
