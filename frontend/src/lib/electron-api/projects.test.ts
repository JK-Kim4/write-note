import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { projects } from "./projects";

/**
 * webElectronApi.projects 매핑 테스트 — HTTP 경계만 msw mock(testing-strategy 허용).
 * shim 이 014 endpoint 를 올바른 메서드·경로로 호출하고 응답을 뷰 모델로 매핑하는지 검증.
 */
const ORIGIN = "http://localhost:3000";

function projectJson(over: Record<string, unknown> = {}) {
    return {
        id: 1,
        title: "작품",
        genre: null,
        targetLength: null,
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

describe("webElectronApi.projects", () => {
    it("list — /api/projects 의 page content 를 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({
                    success: true,
                    data: { content: [projectJson()], page: 0, size: 100, totalElements: 1, totalPages: 1 },
                    error: null,
                }),
            ),
        );

        const result = await projects.list();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(1);
        expect(result[0].nextScene).toBe("");
    });

    it("listCards — 목록에 lastSentenceSource placeholder 를 붙여 반환한다(마지막문장은 화면이 채움, R6)", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({
                    success: true,
                    data: { content: [projectJson({ id: 3 })], page: 0, size: 100, totalElements: 1, totalPages: 1 },
                    error: null,
                }),
            ),
        );

        const cards = await projects.listCards();

        expect(cards).toHaveLength(1);
        expect(cards[0].id).toBe(3);
        expect(cards[0].lastSentenceSource).toBe("");
    });

    it("update — nextScene 을 PATCH 로 보내고 갱신값을 반환한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/projects/1`, async ({ request }) => {
                const body = (await request.json()) as { nextScene?: string };
                return HttpResponse.json({ success: true, data: projectJson({ nextScene: body.nextScene }), error: null });
            }),
        );

        const result = await projects.update(1, { nextScene: "3장 도입부" });

        expect(result.nextScene).toBe("3장 도입부");
    });

    it("create — 작품 생성 후 자동 생성 문서를 함께 반환한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/projects`, () => HttpResponse.json({ success: true, data: projectJson({ id: 9 }), error: null })),
            http.get(`${ORIGIN}/api/projects/9/document`, () =>
                HttpResponse.json({
                    success: true,
                    data: { id: 90, projectId: 9, title: "", body: "{}", wordCount: 0, version: 0, updatedAt: "2026-06-08T00:00:00Z" },
                    error: null,
                }),
            ),
        );

        const { project, document } = await projects.create({ title: "새 작품" });

        expect(project.id).toBe(9);
        expect(document.projectId).toBe(9);
        expect(document.bodyJson).toBe("{}");
    });

    it("get — /api/projects/{id} 단건을 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/projects/5`, () => HttpResponse.json({ success: true, data: projectJson({ id: 5 }), error: null })),
        );

        const result = await projects.get(5);

        expect(result.id).toBe(5);
    });

    it("delete — 삭제 성공 시 true 를 반환한다", async () => {
        server.use(http.delete(`${ORIGIN}/api/projects/1`, () => new HttpResponse(null, { status: 204 })));

        expect(await projects.delete(1)).toBe(true);
    });
});
