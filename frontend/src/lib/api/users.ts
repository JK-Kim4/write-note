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
