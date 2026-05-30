import { apiFetch } from "./client";
import type { AuthMeResponse } from "@/types/api";

/**
 * 인증 API 함수 (005 contracts/proxy-and-client.md §4).
 *
 * login/logout/refresh 등 인증 흐름 endpoint 는 `retryOnAuthFailure: false`
 * (401 이 인증 실패가 아니라 비즈니스 에러 — LOGIN_FAILED 등 — 이므로 refresh 무의미).
 * fetchMe 는 보호 endpoint 라 default(true) — access 만료 시 reactive refresh 경로.
 */

export interface LoginInput {
    email: string;
    password: string;
}

export interface SignupEmailInput {
    email: string;
    password: string;
}

export interface SignupEmailResult {
    userId: number;
    email: string;
    emailVerifySent: boolean;
}

export interface PasswordResetConfirmInput {
    token: string;
    newPassword: string;
}

export function login(input: LoginInput): Promise<unknown> {
    return apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
        retryOnAuthFailure: false,
    });
}

export function signupEmail(input: SignupEmailInput): Promise<SignupEmailResult> {
    return apiFetch<SignupEmailResult>("/api/auth/signup/email", {
        method: "POST",
        body: JSON.stringify(input),
        retryOnAuthFailure: false,
    });
}

export function verifyEmail(token: string): Promise<unknown> {
    return apiFetch("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
        retryOnAuthFailure: false,
    });
}

export function requestPasswordReset(email: string): Promise<unknown> {
    return apiFetch("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
        retryOnAuthFailure: false,
    });
}

export function confirmPasswordReset(input: PasswordResetConfirmInput): Promise<unknown> {
    return apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify(input),
        retryOnAuthFailure: false,
    });
}

export function fetchMe(): Promise<AuthMeResponse> {
    return apiFetch<AuthMeResponse>("/api/auth/me", { method: "GET" });
}

export function logout(): Promise<unknown> {
    return apiFetch("/api/auth/logout", { method: "POST", retryOnAuthFailure: false });
}
