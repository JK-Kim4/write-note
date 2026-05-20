import type { ErrorInfo, Result } from "@/types/api";
import { useAuthPlaceholder } from "@/stores/authPlaceholder";

/**
 * Frontend API client — Phase 1A backend envelope unwrap + 임시 X-User-Id 자동 주입.
 *
 * Spec reference: contracts/api-client.md §4 + spec.md §FR-019
 *
 * 임시 — Week 1B-5 진입 시 X-User-Id 제거 + Authorization Bearer <jwt> swap.
 * 본 client 한 파일 수정으로 전 호출 swap 가능 (단일 책임).
 */

const DEFAULT_BASE_URL = "http://localhost:8080";

const baseUrl = (): string => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    return envBase && envBase.length > 0 ? envBase : DEFAULT_BASE_URL;
};

export class ApiError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

export class UnauthenticatedError extends ApiError {
    constructor() {
        super("UNAUTHENTICATED", "인증이 필요합니다");
        this.name = "UnauthenticatedError";
    }
}

const withAuthHeaders = (headers?: HeadersInit): HeadersInit => {
    const merged = new Headers(headers);
    if (!merged.has("Content-Type")) {
        merged.set("Content-Type", "application/json");
    }
    const userId = useAuthPlaceholder.getState().userId;
    if (userId) {
        merged.set("X-User-Id", userId);
    }
    return merged;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const userId = useAuthPlaceholder.getState().userId;
    if (!userId) {
        throw new UnauthenticatedError();
    }

    let response: Response;
    try {
        response = await fetch(`${baseUrl()}${path}`, {
            ...init,
            headers: withAuthHeaders(init?.headers),
            credentials: "omit",
        });
    } catch (err: unknown) {
        throw new ApiError("NETWORK_ERROR", err instanceof Error ? err.message : String(err));
    }

    if (!response.ok) {
        throw new ApiError(`HTTP_${response.status}`, response.statusText || "Request failed");
    }

    let parsed: Result<T>;
    try {
        parsed = (await response.json()) as Result<T>;
    } catch (err: unknown) {
        throw new ApiError(
            "PARSE_ERROR",
            err instanceof Error ? err.message : "응답 파싱 실패",
        );
    }

    if (parsed.success) {
        return parsed.data;
    }
    const errorInfo: ErrorInfo = parsed.error;
    throw new ApiError(errorInfo.code, errorInfo.message);
}
