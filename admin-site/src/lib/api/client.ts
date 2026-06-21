/**
 * 어드민 앱 HTTP 클라이언트 (030) — frontend/src/lib/api/client.ts 패턴 이식.
 *
 * - same-origin 상대 경로(`/api/...`) → next.config rewrites 프록시(쿠키 자동 동봉).
 * - `X-WriteNote-Client: web` — 백엔드 CsrfDefenseFilter 가 쿠키 변경요청에 요구.
 * - `Result<T>` envelope unwrap. 실패 시 ApiError(code) throw.
 * - 401 reactive refresh 1회(refresh 자체는 재시도 안 함).
 */

export type Result<T> =
    | { success: true; data: T; error: null }
    | { success: false; data: null; error: { code: string; message: string } };

export interface Page<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

const REFRESH_PATH = "/api/auth/refresh";

export class ApiError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.status = status;
    }
}

export type ApiFetchOptions = RequestInit & { retryOnAuthFailure?: boolean };

const rawFetch = (path: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    headers.set("X-WriteNote-Client", "web");
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
    if (response.status === 204) return undefined as T;
    let parsed: Result<T>;
    try {
        parsed = (await response.json()) as Result<T>;
    } catch {
        throw new ApiError(`HTTP_${response.status}`, response.statusText || "요청 실패", response.status);
    }
    if (parsed.success) return parsed.data;
    throw new ApiError(parsed.error.code, parsed.error.message, response.status);
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
        throw new ApiError("NETWORK_ERROR", err instanceof Error ? err.message : String(err), 0);
    }
    return unwrap<T>(response);
}
