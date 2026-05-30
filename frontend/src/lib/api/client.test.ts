import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { ApiError, apiFetch } from "./client";

/**
 * apiFetch 행위 테스트 — envelope unwrap + 401 reactive refresh (005 R-7).
 * HTTP 경계만 msw 로 mock (testing-strategy 허용 대상).
 */

const ORIGIN = "http://localhost:3000";

describe("apiFetch", () => {
    it("200 응답의 Result envelope 를 unwrap 해 data 를 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({ success: true, data: { id: 1, title: "T" }, error: null }),
            ),
        );

        const data = await apiFetch<{ id: number; title: string }>("/api/projects");

        expect(data).toEqual({ id: 1, title: "T" });
    });

    it("보호 요청 401 → refresh 성공 → 원요청을 재시도해 data 를 반환한다", async () => {
        let meCalls = 0;
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () => {
                meCalls += 1;
                if (meCalls === 1) {
                    return HttpResponse.json(
                        { success: false, data: null, error: { code: "AUTH_TOKEN_MISSING", message: "x" } },
                        { status: 401 },
                    );
                }
                return HttpResponse.json({ success: true, data: { userId: 7 }, error: null });
            }),
            http.post(`${ORIGIN}/api/auth/refresh`, () =>
                HttpResponse.json({ success: true, data: {}, error: null }),
            ),
        );

        const data = await apiFetch<{ userId: number }>("/api/auth/me");

        expect(data).toEqual({ userId: 7 });
        expect(meCalls).toBe(2);
    });

    it("보호 요청 401 → refresh 도 401 → ApiError 를 throw 한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "AUTH_TOKEN_MISSING", message: "로그인이 필요합니다" } },
                    { status: 401 },
                ),
            ),
            http.post(`${ORIGIN}/api/auth/refresh`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "AUTH_TOKEN_MISSING", message: "x" } },
                    { status: 401 },
                ),
            ),
        );

        await expect(apiFetch("/api/auth/me")).rejects.toBeInstanceOf(ApiError);
    });
});
