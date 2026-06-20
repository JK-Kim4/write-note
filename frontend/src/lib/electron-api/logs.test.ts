import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { logs } from "./logs";

/**
 * webElectronApi.logs 매핑 테스트(015 T027) — listByProject(014) + list(클라 집계, R6).
 * list 는 작품 목록 × (document·logs/latest·work-sessions/total) 을 조립해 LogCard 를 만든다.
 */
const ORIGIN = "http://localhost:3000";

function projectJson(over: Record<string, unknown> = {}) {
    return {
        id: 1,
        title: "작품",
        genre: null,
        targetLength: 1000,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        archivedAt: null,
        createdAt: "2026-06-08T00:00:00Z",
        updatedAt: "2026-06-08T00:00:00Z",
        ...over,
    };
}

const DOC_BODY = JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "첫 문장. 마지막 문장." }] }],
});

describe("webElectronApi.logs", () => {
    it("listByProject — /api/projects/{id}/logs 를 ProjectLog[] 로 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects/5/logs`, () =>
                HttpResponse.json({
                    success: true,
                    data: [{ id: 9, projectId: 5, body: "기록", createdAt: "2026-06-08T00:00:00Z" }],
                    error: null,
                }),
            ),
        );

        const rows = await logs.listByProject(5);

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(9);
        expect(rows[0].body).toBe("기록");
    });

    it("list — 작품별 document·최신기록·총시간을 조립해 LogCard 를 만든다(마지막 문장 클라 파생)", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({ success: true, data: { content: [projectJson()], page: 0, size: 100, totalElements: 1, totalPages: 1 }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/1/document`, () =>
                HttpResponse.json({ success: true, data: { id: 10, projectId: 1, title: "", body: DOC_BODY, wordCount: 500, version: 1, updatedAt: "2026-06-08T00:00:00Z" }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/1/logs/latest`, () =>
                HttpResponse.json({ success: true, data: { id: 7, projectId: 1, body: "최근 기록", createdAt: "2026-06-08T00:00:00Z" }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/1/work-sessions/total`, () =>
                HttpResponse.json({ success: true, data: { totalDurationMs: 3_600_000 }, error: null }),
            ),
        );

        const cards = await logs.list();

        expect(cards).toHaveLength(1);
        const card = cards[0];
        expect(card.project.id).toBe(1);
        expect(card.wordCount).toBe(500);
        expect(card.totalDurationMs).toBe(3_600_000);
        expect(card.latestLog?.body).toBe("최근 기록");
        expect(card.lastSentenceSource).toContain("마지막 문장");
    });

    it("list — 최신 기록이 없으면 latestLog=null 로 채운다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({ success: true, data: { content: [projectJson({ id: 2 })], page: 0, size: 100, totalElements: 1, totalPages: 1 }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/2/document`, () =>
                HttpResponse.json({ success: true, data: { id: 20, projectId: 2, title: "", body: "{}", wordCount: 0, version: 0, updatedAt: "2026-06-08T00:00:00Z" }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/2/logs/latest`, () => HttpResponse.json({ success: true, data: null, error: null })),
            http.get(`${ORIGIN}/api/projects/2/work-sessions/total`, () => HttpResponse.json({ success: true, data: { totalDurationMs: 0 }, error: null })),
        );

        const cards = await logs.list();

        expect(cards[0].latestLog).toBeNull();
        expect(cards[0].totalDurationMs).toBe(0);
    });
});
