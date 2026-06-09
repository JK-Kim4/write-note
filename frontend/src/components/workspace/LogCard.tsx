"use client";

import { useState } from "react";
import type { LogCard as LogCardData } from "@/lib/types/domain";
import { lastSentence } from "@/lib/lastSentence";
import { calcProgress, formatDuration } from "@/lib/progress";
import { formatRelativeDay } from "@/lib/relativeDate";
import { useProjectLogs } from "@/lib/query/useLogs";

type Props = {
    card: LogCardData;
    now: Date;
    /** "집필하기" — 그 작품을 집필 화면으로 연다. */
    onOpenProject: (projectId: number) => void;
};

/**
 * 기록 화면 작품 카드 — desktop LogCard 1:1 이식(015 US3).
 * 제목·진척 바·최근 수정일·마지막 문장(클라 파생)·총 작업 시간 + 최신 기록 1줄 + 아코디언(lazy 조회).
 */
export function LogCard({ card, now, onOpenProject }: Props) {
    const { project, wordCount, lastSentenceSource, latestLog, totalDurationMs } = card;
    const progress = calcProgress(wordCount, project.targetLength);
    const sentence = lastSentence(lastSentenceSource);
    const relativeDate = formatRelativeDay(project.updatedAt, now);
    const duration = formatDuration(totalDurationMs);

    const [open, setOpen] = useState(false);
    const logsQuery = useProjectLogs(project.id, open);
    const logs = logsQuery.data ?? [];

    return (
        <article className="log-card">
            <header className="log-card__header">
                <h2 className="log-card__title">{project.title}</h2>
                <button type="button" className="log-card__open" onClick={() => onOpenProject(project.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    집필하기
                </button>
            </header>

            <div className="log-card__field">
                <span className="log-card__label">진척도</span>
                {progress !== null ? (
                    <div className="log-card__progress">
                        <div className="log-card__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                            <div className="log-card__bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <span className="log-card__percent">{progress}%</span>
                    </div>
                ) : (
                    <span className="log-card__no-target">목표 미설정</span>
                )}
            </div>

            <div className="log-card__field">
                <span className="log-card__label">최근 수정</span>
                <span className="log-card__value">{relativeDate}</span>
            </div>

            {sentence && (
                <div className="log-card__field">
                    <span className="log-card__label">마지막 문장</span>
                    <p className="log-card__sentence">{sentence}</p>
                </div>
            )}

            <div className="log-card__field">
                <span className="log-card__label">총 작업 시간</span>
                <span className="log-card__value">{duration}</span>
            </div>

            <div className="log-card__log-section">
                <div className="log-card__latest-log">
                    <span className="log-card__label">마지막 기록</span>
                    {latestLog ? (
                        <>
                            <span className="log-card__latest-body">{latestLog.body}</span>
                            <button
                                type="button"
                                className="log-card__accordion-btn"
                                aria-expanded={open}
                                aria-label={open ? "기록 접기" : "기록 펼치기"}
                                onClick={() => setOpen((prev) => !prev)}
                            >
                                {open ? "▲" : "▼"}
                            </button>
                        </>
                    ) : (
                        <span className="log-card__no-log">아직 기록 없음</span>
                    )}
                </div>

                {open && latestLog && (
                    <ul className="log-card__log-list">
                        {logsQuery.isLoading ? (
                            <li className="log-card__log-item">
                                <span className="log-card__log-body">불러오는 중…</span>
                            </li>
                        ) : (
                            logs.map((log) => (
                                <li key={log.id} className="log-card__log-item">
                                    <span className="log-card__log-time">{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                                    <span className="log-card__log-body">{log.body}</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </article>
    );
}
