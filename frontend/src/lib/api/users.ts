import { apiFetch } from "./client";
import type { AuthMeResponse } from "@/types/api";

/**
 * 사용자 계정 API (036).
 *
 * 닉네임 변경은 보호 endpoint 이므로 default(`retryOnAuthFailure: true`) — access 만료 시 reactive refresh.
 * 성공 응답은 갱신된 본인 정보(AuthMeResponse) — 호출부가 `["auth","me"]` 캐시를 갱신한다.
 */
export function setNickname(nickname: string): Promise<AuthMeResponse> {
    return apiFetch<AuthMeResponse>("/api/users/me/nickname", {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
    });
}

/**
 * 비밀번호 추가 등록 (카카오 가입자) — 037 계정 연결.
 * 이미 설정 시 409 `PASSWORD_ALREADY_SET`(공용 client 가 ApiError.code 로 전달).
 */
export function linkEmailPassword(password: string): Promise<unknown> {
    return apiFetch("/api/auth/link/email", {
        method: "POST",
        body: JSON.stringify({ password }),
    });
}

/**
 * 카카오 추가 연결 시작 (이메일 가입자) — 037 계정 연결.
 *
 * ⚠️ R2 실측 영역: POST `/api/auth/link/kakao` 가 session 에 linkUserId 를 박고 302 를 반환한다.
 * 302 는 same-origin opaque(`redirect:'manual'`) 로 받고, 곧바로 OAuth 진입점으로 네비게이션한다.
 * CSRF 심층방어 헤더(X-WriteNote-Client)·쿠키 인증을 함께 보낸다. dogfooding 으로 흐름을 검증한다.
 */
export async function startKakaoLink(): Promise<void> {
    await fetch("/api/auth/link/kakao", {
        method: "POST",
        headers: { "X-WriteNote-Client": "web" },
        credentials: "include",
        redirect: "manual",
    });
    window.location.href = "/api/auth/oauth/kakao";
}
