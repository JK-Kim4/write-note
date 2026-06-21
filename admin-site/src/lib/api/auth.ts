import { apiFetch } from "./client";

/** 어드민 로그인 — 기존 백엔드 인증 재사용. 관리자 여부는 백엔드가 /api/admin/* 에서 403 으로 강제. */
export function login(email: string, password: string): Promise<unknown> {
    return apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        retryOnAuthFailure: false,
    });
}

export function logout(): Promise<unknown> {
    return apiFetch("/api/auth/logout", { method: "POST", retryOnAuthFailure: false });
}
