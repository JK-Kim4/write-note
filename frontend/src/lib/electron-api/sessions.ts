/**
 * webElectronApi.sessions (015 US3) — desktop `electronAPI.sessions` 의 web 구현체.
 *
 * 종료 트리거(R6/FR-019): (1) 집필실 라우트 이탈 시 `end`(일반 fetch), (2) 탭/창 닫기 시 `endBeacon`
 * (sendBeacon — 언로드 중에도 same-origin 쿠키 동반 POST 가 전송됨). 종료 신호 유실은 014 의 dangling
 * 세션 정리가 backstop. 백그라운드 탭 전환(가시성 변화)은 종료 트리거가 아니다(계속 작업 중 간주).
 */
import { apiFetch } from "@/lib/api/client";

export const sessions = {
    /** 집필 진입 시 작업 세션 시작(014 가 작품당 열린 세션 1개 보장). */
    start: async (projectId: number): Promise<void> => {
        await apiFetch(`/api/projects/${projectId}/work-sessions/start`, { method: "POST" });
    },

    /** 라우트 이탈 시 자동 종료(30초 미만 폐기는 014 가 처리). */
    end: async (projectId: number): Promise<void> => {
        await apiFetch(`/api/projects/${projectId}/work-sessions/end`, { method: "POST" });
    },

    /**
     * 탭/창 닫기 best-effort 종료 — sendBeacon 으로 언로드 중에도 전송. 쿠키는 same-origin 자동 동반.
     * sendBeacon 미지원/유실 시 014 dangling 정리가 통계를 보정한다.
     */
    endBeacon: (projectId: number): void => {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            navigator.sendBeacon(`/api/projects/${projectId}/work-sessions/end`);
        }
    },

    /** "작업 종료+기록" — 세션 종료(짧아도 보존) + 집필 기록 생성(단일 트랜잭션, 014). */
    endWithLog: async (projectId: number, body: string): Promise<void> => {
        await apiFetch(`/api/projects/${projectId}/work-sessions/end-with-log`, {
            method: "POST",
            body: JSON.stringify({ body }),
        });
    },
};
