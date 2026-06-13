"use client";

import { useState } from "react";
import { useLogCards, useProjectLogs } from "@/lib/query/useLogs";
import { lastSentence } from "@/lib/lastSentence";
import type { LogCard } from "@/lib/types/domain";

/**
 * B타입 기록 화면 — fable-test DashboardPage 의 통계 카드 문법을 현재 도메인(집필 기록)에 적용.
 * 상단 합계 카드(총 글자수 / 총 작업시간 / 작품 수) + 작품별 진척 카드(펼치면 누적 기록).
 * 공백 최소화: 별도 대시보드 없이 기록 화면이 통계까지 겸한다.
 */

function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    // 1분 미만(예: 40초) 작업이 "0분"으로 사라지지 않도록 분기 — 0보다 크면 "1분 미만".
    if (h === 0 && m === 0) return ms > 0 ? "1분 미만" : "0분";
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
                {value}
                <span className="ml-1 text-base font-normal text-gray-500">{unit}</span>
            </p>
        </div>
    );
}

function ProjectLogCard({ card }: { card: LogCard }) {
    const [isOpen, setIsOpen] = useState(false);
    const logsQuery = useProjectLogs(card.project.id, isOpen);
    const logs = logsQuery.data ?? [];
    const panelId = `project-logs-${card.project.id}`;
    // 본문에서 파생한 마지막 문장(저장값 아님). 작업 종료 메모(latestLog.body)와 의미가 달라 별도 줄로 노출.
    const sentence = lastSentence(card.lastSentenceSource);

    return (
        <div className="rounded-xl border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
                <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-gray-900">{card.project.title}</h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                        {card.wordCount.toLocaleString()}자 · 누적 {formatDuration(card.totalDurationMs)}
                    </p>
                    {sentence && (
                        <p className="mt-1 truncate text-sm text-gray-600">마지막 문장 — {sentence}</p>
                    )}
                    {card.latestLog && (
                        <p className="mt-0.5 truncate text-sm text-gray-500 sm:hidden">{card.latestLog.body}</p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {card.latestLog && (
                        <span className="hidden max-w-64 truncate text-sm text-gray-500 sm:block">
                            {card.latestLog.body}
                        </span>
                    )}
                    <span aria-hidden="true" className="text-gray-400">
                        {isOpen ? "▲" : "▼"}
                    </span>
                </div>
            </button>
            {isOpen && (
                <div id={panelId} className="border-t border-gray-100 px-4 py-3">
                    {logsQuery.isLoading ? (
                        <p className="text-xs text-gray-400">불러오는 중…</p>
                    ) : logsQuery.isError ? (
                        <div>
                            <p className="text-xs text-gray-500">기록을 불러올 수 없습니다.</p>
                            <button
                                type="button"
                                onClick={() => logsQuery.refetch()}
                                className="mt-2 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            >
                                다시 시도
                            </button>
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-xs text-gray-400">
                            아직 기록이 없습니다. 집필을 마칠 때 &ldquo;작업 종료&rdquo;로 기록을 남겨보세요.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {logs.map((log) => (
                                <li key={log.id} className="flex items-baseline gap-3">
                                    <span className="shrink-0 text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
                                    <span className="text-sm whitespace-pre-wrap text-gray-700">{log.body}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

export default function BLogsPage() {
    const { data: cards, isLoading, isError, refetch } = useLogCards();

    const totalWordCount = (cards ?? []).reduce((sum, c) => sum + c.wordCount, 0);
    const totalDurationMs = (cards ?? []).reduce((sum, c) => sum + c.totalDurationMs, 0);

    return (
        <div>
            <h1 className="mb-6 text-xl font-bold">기록</h1>

            {isLoading ? (
                <p className="py-12 text-center text-sm text-gray-400">불러오는 중…</p>
            ) : isError ? (
                <div className="py-12 text-center">
                    <p className="text-sm text-gray-500">기록을 불러올 수 없습니다.</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        다시 시도
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <StatCard label="총 글자수" value={totalWordCount.toLocaleString()} unit="자" />
                        <StatCard label="총 작업시간" value={formatDuration(totalDurationMs)} unit="" />
                        <StatCard label="작품" value={String((cards ?? []).length)} unit="편" />
                    </div>
                    <div className="space-y-3">
                        {(cards ?? []).map((card) => (
                            <ProjectLogCard key={card.project.id} card={card} />
                        ))}
                        {(cards ?? []).length === 0 && (
                            <p className="py-8 text-center text-sm text-gray-500">아직 작품이 없습니다.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
