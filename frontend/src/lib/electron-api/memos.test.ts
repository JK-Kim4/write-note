import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { memos } from "./memos";

/**
 * webElectronApi.memos 매핑 테스트(015 T020) — HTTP 경계만 msw mock(testing-strategy 허용).
 * shim 이 014/006 endpoint 를 올바른 메서드·경로로 호출하고 응답을 뷰 모델로 매핑하는지 검증.
 *
 * 주의(검증된 백엔드 동작):
 * - 캡처(POST /api/memos)는 작품을 "연결"하지 않고 activeProjectAtCapture(맥락)만 기록한다.
 *   따라서 작품에 붙은 메모(서랍 listByProject 노출)를 만들려면 캡처 후 curation 으로 연결해야 한다.
 * - addLink/removeLink 는 선언적 큐레이션(PUT /api/memos/{id}/curation)으로 매핑 → 기존 상태를 읽고 차이를 반영.
 */
const ORIGIN = "http://localhost:3000";

function memoJson(over: Record<string, unknown> = {}) {
    return {
        id: 1,
        body: "메모 본문",
        source: "DESKTOP",
        capturedAt: "2026-06-08T00:00:00Z",
        activeProjectAtCapture: null,
        reasonNote: null,
        tags: [] as string[],
        projects: [] as Array<{ projectId: number; title: string; characters: Array<{ characterId: number; name: string }> }>,
        ...over,
    };
}

describe("webElectronApi.memos", () => {
    it("listByProject — /api/projects/{id}/memos 를 ProjectMemo(id/pinned) 로 매핑한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects/7/memos`, () =>
                HttpResponse.json({
                    success: true,
                    data: [
                        { memoId: 11, projectId: 7, body: "메모", source: "DESKTOP", capturedAt: "2026-06-08T00:00:00Z", reasonNote: null, tags: [], pinned: true },
                    ],
                    error: null,
                }),
            ),
        );

        const rows = await memos.listByProject(7);

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(11);
        expect(rows[0].projectId).toBe(7);
        expect(rows[0].pinned).toBe(true);
    });

    it("setPin — PUT /api/projects/{projectId}/memos/{memoId}/pin 에 pinned 를 보낸다", async () => {
        let received: unknown;
        server.use(
            http.put(`${ORIGIN}/api/projects/7/memos/11/pin`, async ({ request }) => {
                received = await request.json();
                return HttpResponse.json({
                    success: true,
                    data: { memoId: 11, projectId: 7, body: "x", source: "DESKTOP", capturedAt: "2026-06-08T00:00:00Z", reasonNote: null, tags: [], pinned: true },
                    error: null,
                });
            }),
        );

        await memos.setPin(11, 7, true);

        expect(received).toEqual({ pinned: true });
    });

    it("list — /api/memos page content 를 Memo(linkedProjects) 로 매핑한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/memos`, () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        content: [memoJson({ id: 3, body: "메모", projects: [{ projectId: 7, title: "작품A", characters: [] }] })],
                        page: 0,
                        size: 100,
                        totalElements: 1,
                        totalPages: 1,
                    },
                    error: null,
                }),
            ),
        );

        const rows = await memos.list();

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(3);
        expect(rows[0].linkedProjects).toEqual([{ id: 7, title: "작품A" }]);
    });

    it("create — 미연결(linkProjectId=null)이면 POST /api/memos 만 호출한다", async () => {
        let curated = false;
        server.use(
            http.post(`${ORIGIN}/api/memos`, () => HttpResponse.json({ success: true, data: memoJson({ id: 5 }), error: null })),
            http.put(`${ORIGIN}/api/memos/5/curation`, () => {
                curated = true;
                return HttpResponse.json({ success: true, data: memoJson({ id: 5 }), error: null });
            }),
        );

        const m = await memos.create({ body: "한 줄", linkProjectId: null });

        expect(m.id).toBe(5);
        expect(curated).toBe(false);
    });

    it("create — linkProjectId 가 있으면 캡처 후 curation 으로 그 작품에 연결한다", async () => {
        let curationBody: { projectConnections?: unknown } = {};
        server.use(
            http.post(`${ORIGIN}/api/memos`, async ({ request }) => {
                const sent = (await request.json()) as { activeProjectId?: number };
                expect(sent.activeProjectId).toBe(7);
                return HttpResponse.json({ success: true, data: memoJson({ id: 5 }), error: null });
            }),
            http.put(`${ORIGIN}/api/memos/5/curation`, async ({ request }) => {
                curationBody = (await request.json()) as { projectConnections?: unknown };
                return HttpResponse.json({ success: true, data: memoJson({ id: 5, projects: [{ projectId: 7, title: "A", characters: [] }] }), error: null });
            }),
        );

        await memos.create({ body: "한 줄", linkProjectId: 7 });

        expect(curationBody.projectConnections).toEqual([{ projectId: 7, characterIds: [] }]);
    });

    it("addLink — 기존 연결·태그·사유를 보존하며 작품을 추가해 curation PUT 한다", async () => {
        let body: { projectConnections?: unknown; tags?: unknown; reasonNote?: unknown } = {};
        server.use(
            http.get(`${ORIGIN}/api/memos/5`, () =>
                HttpResponse.json({
                    success: true,
                    data: memoJson({ id: 5, tags: ["t"], reasonNote: "r", projects: [{ projectId: 7, title: "A", characters: [{ characterId: 1, name: "갑" }] }] }),
                    error: null,
                }),
            ),
            http.put(`${ORIGIN}/api/memos/5/curation`, async ({ request }) => {
                body = (await request.json()) as typeof body;
                return HttpResponse.json({ success: true, data: memoJson({ id: 5 }), error: null });
            }),
        );

        await memos.addLink(5, 9);

        expect(body.projectConnections).toEqual([
            { projectId: 7, characterIds: [1] },
            { projectId: 9, characterIds: [] },
        ]);
        expect(body.tags).toEqual(["t"]);
        expect(body.reasonNote).toBe("r");
    });

    it("removeLink — 해당 작품 연결만 빼고 curation PUT 한다", async () => {
        let body: { projectConnections?: unknown } = {};
        server.use(
            http.get(`${ORIGIN}/api/memos/5`, () =>
                HttpResponse.json({
                    success: true,
                    data: memoJson({ id: 5, projects: [{ projectId: 7, title: "A", characters: [] }, { projectId: 9, title: "B", characters: [] }] }),
                    error: null,
                }),
            ),
            http.put(`${ORIGIN}/api/memos/5/curation`, async ({ request }) => {
                body = (await request.json()) as typeof body;
                return HttpResponse.json({ success: true, data: memoJson({ id: 5, projects: [{ projectId: 9, title: "B", characters: [] }] }), error: null });
            }),
        );

        await memos.removeLink(5, 7);

        expect(body.projectConnections).toEqual([{ projectId: 9, characterIds: [] }]);
    });
});
