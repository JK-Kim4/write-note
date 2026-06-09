import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { sessions } from "./sessions";

/** webElectronApi.sessions 매핑 테스트(015 T027) — 014 work-sessions endpoint 호출 검증. */
const ORIGIN = "http://localhost:3000";

describe("webElectronApi.sessions", () => {
    it("start — POST /api/projects/{id}/work-sessions/start 를 호출한다", async () => {
        let called = false;
        server.use(
            http.post(`${ORIGIN}/api/projects/3/work-sessions/start`, () => {
                called = true;
                return HttpResponse.json({ success: true, data: { id: 1, projectId: 3, startedAt: "2026-06-08T00:00:00Z", endedAt: null }, error: null });
            }),
        );

        await sessions.start(3);

        expect(called).toBe(true);
    });

    it("end — POST …/work-sessions/end 를 호출한다(폐기/없음 시 data=null 허용)", async () => {
        let called = false;
        server.use(
            http.post(`${ORIGIN}/api/projects/3/work-sessions/end`, () => {
                called = true;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );

        await sessions.end(3);

        expect(called).toBe(true);
    });

    it("endWithLog — POST …/end-with-log 에 기록 body 를 전달한다", async () => {
        let received: unknown;
        server.use(
            http.post(`${ORIGIN}/api/projects/3/work-sessions/end-with-log`, async ({ request }) => {
                received = await request.json();
                return HttpResponse.json({
                    success: true,
                    data: { session: null, log: { id: 1, projectId: 3, body: "오늘 기록", createdAt: "2026-06-08T00:00:00Z" } },
                    error: null,
                });
            }),
        );

        await sessions.endWithLog(3, "오늘 기록");

        expect(received).toEqual({ body: "오늘 기록" });
    });
});
