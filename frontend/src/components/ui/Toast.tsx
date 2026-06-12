"use client";

import { useEffect } from "react";

type ToastProps = {
    message: string;
    actionLabel: string;
    onAction: () => void;
    onDismiss: () => void;
    /** 자동 소멸까지 시간(ms). 이후 되돌리기 경로 종료. */
    durationMs?: number;
};

/**
 * 되돌리기 가능한 단일 토스트 (019 US1 — desktop Toast 1:1 포팅).
 * 마운트 시 타이머로 자동 소멸, unmount 시 정리. 새 삭제가 오면 호출부가 key 교체로 remount → 타이머 재시작(최근 1건 대상).
 */
export function Toast({ message, actionLabel, onAction, onDismiss, durationMs = 5000 }: ToastProps) {
    useEffect(() => {
        const timer = window.setTimeout(onDismiss, durationMs);
        return () => window.clearTimeout(timer);
    }, [onDismiss, durationMs]);

    return (
        <div className="toast" role="status">
            <span className="toast__msg">{message}</span>
            <button type="button" className="toast__action" onClick={onAction}>
                {actionLabel}
            </button>
        </div>
    );
}
