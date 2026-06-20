"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { sessionKeys } from "@/lib/query/useSessions";

/**
 * 집필실 작업 세션 라이프사이클 (015 US3, R6/FR-019).
 *
 * 진입 시 `start`, 종료 트리거 2가지:
 * - 집필실 라우트 이탈(컴포넌트 unmount) → `end`(일반 fetch)
 * - 탭/창 닫기(`pagehide`) → `endBeacon`(sendBeacon, 언로드 중 전송)
 *
 * `endWithLog`("작업 종료+기록")가 세션을 먼저 닫으면 이후 이탈/탭닫기 종료를 1회 스킵한다(이중 종료 방지).
 * 종료 신호 유실은 014 의 dangling 세션 정리가 backstop. 백그라운드 탭 전환(가시성)은 종료 트리거가 아니다.
 */
export function useWorkSession(projectId: number) {
    const closedRef = useRef(false);
    const queryClient = useQueryClient();

    // 세션 종료 후 집필 리듬/작업시간 집계를 신선화 — 홈 복귀 시 즉시 반영(028 US1).
    // unload(beacon) 경로는 페이지가 닫히는 중이라 무효화 대상 아님.
    const invalidateSessions = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    }, [queryClient]);

    useEffect(() => {
        if (!Number.isFinite(projectId)) return;
        closedRef.current = false;

        // dev StrictMode 는 effect 를 mount→unmount→mount 로 두 번(동기) 실행한다. start 를 microtask 로 미뤄,
        // 1차 effect 의 start 는 곧 이어지는 cleanup(active=false)에서 취소되고 2차 effect 의 start 만 살아남는다
        // → 동시 이중 start 로 인한 uq_work_session_open 경합(서버 멱등 처리와 별개로 불필요 POST) 제거.
        let active = true;
        queueMicrotask(() => {
            if (active) void webElectronApi.sessions.start(projectId);
        });

        const onPageHide = () => {
            if (closedRef.current) return;
            closedRef.current = true;
            webElectronApi.sessions.endBeacon(projectId);
        };
        window.addEventListener("pagehide", onPageHide);

        return () => {
            active = false;
            window.removeEventListener("pagehide", onPageHide);
            if (closedRef.current) return;
            closedRef.current = true;
            void webElectronApi.sessions.end(projectId).then(invalidateSessions);
        };
    }, [projectId, invalidateSessions]);

    const endWithLog = useCallback(
        async (body: string) => {
            // 명시 종료가 세션을 닫으므로, 이후 unmount/pagehide 의 중복 종료를 스킵한다.
            closedRef.current = true;
            try {
                await webElectronApi.sessions.endWithLog(projectId, body);
                invalidateSessions();
            } catch (e) {
                // 종료 실패 시 스킵 플래그 복원 — 다음 정상 이탈에서 세션이 제대로 닫히도록(desktop 정합).
                closedRef.current = false;
                throw e;
            }
        },
        [projectId, invalidateSessions],
    );

    return { endWithLog };
}
