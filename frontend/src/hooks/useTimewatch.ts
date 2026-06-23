"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { sessionKeys } from "@/lib/query/useSessions";
import { logKeys } from "@/lib/query/useLogs";

export type TimewatchStatus = "idle" | "running" | "paused";

/**
 * 타임워치(집필 시간 사용자 제어 측정) — 자동 시간측정을 대체한다.
 *
 * 매핑: 시작=sessions.start, 일시정지=end(구간 종료·누적 보존), 다시 시작=start(새 구간),
 * 집필 종료=메모 있으면 endWithLog / 없으면 running 일 때 end. running 중 이탈(unmount/pagehide)은
 * 그때까지 시간을 자동 기록(end/endBeacon). 종료류 후 작업시간 집계(sessionKeys) 무효화.
 *
 * 누적 표시(elapsedMs)는 클라 로컬 상태 — 서버 영속 없음. 재진입 시 0 부터(그전 기록은 서버에 저장됨).
 */
export function useTimewatch(projectId: number): {
    status: TimewatchStatus;
    elapsedMs: number;
    start: () => void;
    pause: () => void;
    resume: () => void;
    stop: (memo?: string) => Promise<void>;
} {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<TimewatchStatus>("idle");
    const [elapsedMs, setElapsedMs] = useState(0);
    // 완료 구간 누적 ms + 현재 running 구간 시작 시각(ms epoch). 표시는 1초 틱으로 갱신.
    const accumulatedRef = useRef(0);
    const segmentStartRef = useRef<number | null>(null);
    const statusRef = useRef<TimewatchStatus>("idle");
    statusRef.current = status;

    const invalidateSessions = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    }, [queryClient]);

    useEffect(() => {
        if (status !== "running") return;
        const tick = () => {
            const seg = segmentStartRef.current;
            setElapsedMs(accumulatedRef.current + (seg != null ? Date.now() - seg : 0));
        };
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [status]);

    const start = useCallback(() => {
        if (statusRef.current !== "idle") return;
        accumulatedRef.current = 0;
        segmentStartRef.current = Date.now();
        setElapsedMs(0);
        setStatus("running");
        void webElectronApi.sessions.start(projectId);
    }, [projectId]);

    const pause = useCallback(() => {
        if (statusRef.current !== "running") return;
        const seg = segmentStartRef.current;
        if (seg != null) accumulatedRef.current += Date.now() - seg;
        segmentStartRef.current = null;
        setElapsedMs(accumulatedRef.current);
        setStatus("paused");
        void webElectronApi.sessions.end(projectId).then(invalidateSessions);
    }, [projectId, invalidateSessions]);

    const resume = useCallback(() => {
        if (statusRef.current !== "paused") return;
        segmentStartRef.current = Date.now();
        setStatus("running");
        void webElectronApi.sessions.start(projectId);
    }, [projectId]);

    const stop = useCallback(
        async (memo?: string) => {
            const trimmed = memo?.trim() ?? "";
            const wasRunning = statusRef.current === "running";
            try {
                if (trimmed) {
                    await webElectronApi.sessions.endWithLog(projectId, trimmed);
                    await queryClient.invalidateQueries({ queryKey: logKeys.all });
                } else if (wasRunning) {
                    await webElectronApi.sessions.end(projectId);
                }
                invalidateSessions();
            } finally {
                accumulatedRef.current = 0;
                segmentStartRef.current = null;
                setElapsedMs(0);
                setStatus("idle");
            }
        },
        [projectId, queryClient, invalidateSessions],
    );

    // running 중 이탈 — 그때까지 시간 기록(unmount=end, pagehide=endBeacon). idle/paused 면 열린 세션 없음 → no-op.
    useEffect(() => {
        const onPageHide = () => {
            if (statusRef.current === "running") webElectronApi.sessions.endBeacon(projectId);
        };
        window.addEventListener("pagehide", onPageHide);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            if (statusRef.current === "running") {
                void webElectronApi.sessions.end(projectId).then(invalidateSessions);
            }
        };
    }, [projectId, invalidateSessions]);

    return { status, elapsedMs, start, pause, resume, stop };
}
