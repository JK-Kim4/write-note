import type { Result } from "@/types/api";

/**
 * Frontend API client — backend `Result<T>` envelope unwrap + httpOnly 쿠키 인증 (005 R-7/R-9).
 *
 * Spec reference: contracts/proxy-and-client.md §2
 *
 * - same-origin 상대 경로(`/api/...`) — Next rewrites 가 backend 로 프록시 (next.config.ts).
 * - `credentials: "include"` — httpOnly 쿠키 자동 전송. 임시 사용자 식별 헤더 주입 폐기(003/005).
 * - 401 reactive refresh: 보호 요청 401 → `POST /api/auth/refresh`(쿠키의 refresh_token) 1회 → 성공 시 원요청 재시도.
 *   refresh 자체 / 인증 흐름(login·logout 등)은 `retryOnAuthFailure: false` 로 무한 루프 방지.
 */

const REFRESH_PATH = "/api/auth/refresh";

export class ApiError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

export type ApiFetchOptions = RequestInit & {
    /** 401 시 reactive refresh 후 재시도 여부 (default true). 인증 흐름 endpoint 는 false. */
    retryOnAuthFailure?: boolean;
};

const rawFetch = (path: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    return fetch(path, { ...init, headers, credentials: "include" });
};

const tryRefresh = async (): Promise<boolean> => {
    try {
        const res = await rawFetch(REFRESH_PATH, { method: "POST" });
        return res.ok;
    } catch {
        return false;
    }
};

const unwrap = async <T>(response: Response): Promise<T> => {
    if (response.status === 204) {
        return undefined as T;
    }
    let parsed: Result<T>;
    try {
        parsed = (await response.json()) as Result<T>;
    } catch {
        throw new ApiError(`HTTP_${response.status}`, response.statusText || "요청 실패");
    }
    if (parsed.success) {
        return parsed.data;
    }
    throw new ApiError(parsed.error.code, parsed.error.message);
};

export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
    const { retryOnAuthFailure = true, ...requestInit } = init;

    let response: Response;
    try {
        response = await rawFetch(path, requestInit);
        if (response.status === 401 && retryOnAuthFailure && path !== REFRESH_PATH) {
            if (await tryRefresh()) {
                response = await rawFetch(path, requestInit);
            }
        }
    } catch (err: unknown) {
        throw new ApiError("NETWORK_ERROR", err instanceof Error ? err.message : String(err));
    }

    return unwrap<T>(response);
}
