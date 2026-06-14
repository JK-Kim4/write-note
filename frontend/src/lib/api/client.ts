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
 * - 409 DOCUMENT_VERSION_CONFLICT: `ConflictError` throw — currentVersion/currentBody 포함 (006 US1 자동저장).
 * - 409 LAST_CHAPTER_UNDELETABLE: `LastChapterError` throw — 마지막 활성 챕터 삭제 거부 (022 US3).
 *   ⚠️ 409 분기는 error.code 기준 — EMAIL_ALREADY_REGISTERED / KAKAO_ALREADY_LINKED 등 다른 409 와 status 공유.
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

/** 문서 버전 충돌(409) 전용 에러 — currentVersion(불투명 토큰 문자열) 과 currentBody 포함 (006 US1 / 016). */
export class ConflictError extends Error {
    code: string;
    currentVersion: string;
    currentBody: string;

    constructor(currentVersion: string, currentBody: string) {
        super("문서가 다른 곳에서 변경되었습니다.");
        this.name = "ConflictError";
        this.code = "DOCUMENT_VERSION_CONFLICT";
        this.currentVersion = currentVersion;
        this.currentBody = currentBody;
    }
}

/** 마지막 활성 챕터 삭제 거부(409) 전용 에러 — 022 US3 C4. */
export class LastChapterError extends Error {
    code: string;

    constructor(message = "마지막 챕터는 삭제할 수 없습니다.") {
        super(message);
        this.name = "LastChapterError";
        this.code = "LAST_CHAPTER_UNDELETABLE";
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
    // 409 충돌 — DOCUMENT_VERSION_CONFLICT 만 ConflictError(currentVersion/currentBody).
    // EMAIL_ALREADY_REGISTERED / KAKAO_ALREADY_LINKED 등 다른 409 는 기존 ApiError 흐름 유지(회귀 방지).
    if (response.status === 409) {
        let body: unknown;
        try {
            body = await response.json();
        } catch {
            throw new ApiError("CONFLICT", "충돌이 발생했습니다.");
        }
        const b = body as Record<string, unknown>;
        const error = b["error"] as Record<string, unknown> | null | undefined;
        const code = typeof error?.["code"] === "string" ? error["code"] : undefined;
        if (code === "DOCUMENT_VERSION_CONFLICT") {
            const data = b["data"] as Record<string, unknown> | null | undefined;
            const currentVersion = typeof data?.["currentVersion"] === "string" ? data["currentVersion"] : "";
            const currentBody = typeof data?.["currentBody"] === "string" ? data["currentBody"] : "";
            throw new ConflictError(currentVersion, currentBody);
        }
        if (code === "LAST_CHAPTER_UNDELETABLE") {
            throw new LastChapterError(
                typeof error?.["message"] === "string" ? error["message"] : undefined,
            );
        }
        throw new ApiError(
            code ?? "CONFLICT",
            typeof error?.["message"] === "string" ? error["message"] : "충돌이 발생했습니다.",
        );
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
