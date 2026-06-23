"use client";

import { formatStopwatch } from "@/lib/formatStopwatch";
import type { TimewatchStatus } from "@/hooks/useTimewatch";

type TimewatchProps = {
    status: TimewatchStatus;
    elapsedMs: number;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onRequestStop: () => void;
};

const LABEL: Record<TimewatchStatus, string> = {
    idle: "집필 시간",
    running: "집필 중",
    paused: "일시정지",
};

const PRIMARY = "flex-1 rounded-lg bg-terracotta-600 px-3 py-2 text-sm font-semibold text-white hover:bg-terracotta-700";
const GHOST = "flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50";
const STOP = "flex-1 rounded-lg border border-terracotta-200 bg-white px-3 py-2 text-sm font-semibold text-terracotta-700 hover:bg-terracotta-50";

/** 타임워치 카드(031 분량 카드처럼 우패널 상단 독립 카드). 상태별 버튼 전환 — 로직은 useTimewatch 가 소유. */
export function Timewatch({ status, elapsedMs, onStart, onPause, onResume, onRequestStop }: TimewatchProps) {
    const dot =
        status === "running"
            ? "bg-green-500 shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
            : status === "paused"
              ? "bg-terracotta-500"
              : "bg-gray-300";
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gray-400">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
                {LABEL[status]}
            </div>
            <div className={`text-3xl font-extrabold tabular-nums ${status === "idle" ? "text-gray-400" : "text-gray-900"}`}>
                {formatStopwatch(elapsedMs)}
            </div>
            <div className="mt-2.5 flex gap-1.5">
                {status === "idle" && (
                    <button type="button" onClick={onStart} className={PRIMARY}>▶ 시작</button>
                )}
                {status === "running" && (
                    <>
                        <button type="button" onClick={onPause} className={GHOST}>⏸ 일시정지</button>
                        <button type="button" onClick={onRequestStop} className={STOP}>■ 집필 종료</button>
                    </>
                )}
                {status === "paused" && (
                    <>
                        <button type="button" onClick={onResume} className={PRIMARY}>▶ 다시 시작</button>
                        <button type="button" onClick={onRequestStop} className={STOP}>■ 집필 종료</button>
                    </>
                )}
            </div>
        </div>
    );
}
