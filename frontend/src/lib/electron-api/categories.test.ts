import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { categories } from "./categories";

/**
 * webElectronApi.categories 매핑 테스트 (032) — HTTP 경계만 msw mock.
 * shim 이 /api/categories + 작품 이동 엔드포인트를 올바른 메서드·경로로 호출하는지 검증.
 */
const ORIGIN = "http://localhost:3000";

function categoryJson(over: Record<string, unknown> = {}) {
    return {
        id: 1,
        name: "장편 판타지",
        parentId: null,
        sortOrder: 0,
        projectCount: 0,
        createdAt: "2026-06-22T00:00:00Z",
        updatedAt: "2026-06-22T00:00:00Z",
        ...over,
    };
}

describe("webElectronApi.categories", () => {
    it("list — /api/categories 배열을 반환한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/categories`, () =>
                HttpResponse.json({
                    success: true,
                    data: [categoryJson({ id: 3, name: "단편 모음", projectCount: 2 })],
                    error: null,
                }),
            ),
        );

        const result = await categories.list();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(3);
        expect(result[0].name).toBe("단편 모음");
        expect(result[0].projectCount).toBe(2);
    });

    it("create — name 을 POST 로 보내고 생성값을 반환한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/categories`, async ({ request }) => {
                const body = (await request.json()) as { name: string };
                return HttpResponse.json({ success: true, data: categoryJson({ id: 9, name: body.name }), error: null });
            }),
        );

        const result = await categories.create("새 모음");

        expect(result.id).toBe(9);
        expect(result.name).toBe("새 모음");
    });

    it("update — 이름 변경 PATCH 후 갱신값을 반환한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/categories/9`, async ({ request }) => {
                const body = (await request.json()) as { name?: string };
                return HttpResponse.json({ success: true, data: categoryJson({ id: 9, name: body.name }), error: null });
            }),
        );

        const result = await categories.update(9, { name: "장편" });

        expect(result.name).toBe("장편");
    });

    it("delete — 204 시 true 를 반환한다", async () => {
        server.use(http.delete(`${ORIGIN}/api/categories/9`, () => new HttpResponse(null, { status: 204 })));

        expect(await categories.delete(9)).toBe(true);
    });

    it("moveProject — 작품을 모음으로 PATCH 한다 (categoryId)", async () => {
        let sent: { categoryId: number | null } | null = null;
        server.use(
            http.patch(`${ORIGIN}/api/projects/5/category`, async ({ request }) => {
                sent = (await request.json()) as { categoryId: number | null };
                return HttpResponse.json({ success: true, data: { id: 5, categoryId: sent.categoryId }, error: null });
            }),
        );

        await categories.moveProject(5, 7);

        expect(sent).toEqual({ categoryId: 7 });
    });

    it("moveProject — categoryId null 로 미분류 이동", async () => {
        let sent: { categoryId: number | null } | null = null;
        server.use(
            http.patch(`${ORIGIN}/api/projects/5/category`, async ({ request }) => {
                sent = (await request.json()) as { categoryId: number | null };
                return HttpResponse.json({ success: true, data: { id: 5, categoryId: null }, error: null });
            }),
        );

        await categories.moveProject(5, null);

        expect(sent).toEqual({ categoryId: null });
    });
});
