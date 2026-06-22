import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import BWorksPage from "./page";

/**
 * 작품 페이지(032) — 편집 모달의 '시리즈' 드롭다운으로 작품을 시리즈로 이동(카드 ⋯ 오버레이 대체).
 * 시리즈 변경분은 전용 엔드포인트(PATCH /api/projects/{id}/category)로 나가야 한다.
 */
const ORIGIN = "http://localhost:3000";

function serverCard(id: number, categoryId: number | null) {
    return {
        id,
        title: `작품${id}`,
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        categoryId,
        paperSize: "A4",
        layoutMode: "paper",
        fontScale: "m",
        archivedAt: null,
        createdAt: "2026-06-22T00:00:00Z",
        updatedAt: "2026-06-22T00:00:00Z",
        wordCount: 0,
        documentUpdatedAt: "2026-06-22T00:00:00Z",
        totalDurationMs: 0,
        lastSentenceSource: "",
    };
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BWorksPage />
        </QueryClientProvider> as ReactNode,
    );
}

// 드릴인(?folder=) 상태가 테스트 간에 새지 않도록 URL 초기화
beforeEach(() => window.history.replaceState(null, "", "/library"));
afterEach(() => window.history.replaceState(null, "", "/library"));

describe("BWorksPage — 편집 모달 시리즈 이동", () => {
    it("편집 모달에서 시리즈를 고르면 전용 이동 엔드포인트로 반영한다", async () => {
        let categoryBody: unknown = null;
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [serverCard(1, null)], error: null }),
            ),
            http.get(`${ORIGIN}/api/categories`, () =>
                HttpResponse.json({
                    success: true,
                    data: [
                        { id: 7, name: "가나다", parentId: null, sortOrder: 1, projectCount: 0, createdAt: "", updatedAt: "" },
                        { id: 8, name: "마바사", parentId: null, sortOrder: 2, projectCount: 0, createdAt: "", updatedAt: "" },
                    ],
                    error: null,
                }),
            ),
            http.patch(`${ORIGIN}/api/projects/1`, () =>
                HttpResponse.json({ success: true, data: serverCard(1, null), error: null }),
            ),
            http.patch(`${ORIGIN}/api/projects/1/category`, async ({ request }) => {
                categoryBody = await request.json();
                return HttpResponse.json({ success: true, data: { id: 1, categoryId: 7 }, error: null });
            }),
        );

        renderPage();

        // 카드 로드 후 편집 진입
        await userEvent.click(await screen.findByRole("button", { name: "작품1 편집" }));
        const dialog = await screen.findByRole("dialog", { name: "작품 편집" });

        // 시리즈 = 미분류 → 가나다(7)
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "시리즈" }), "7");
        await userEvent.click(screen.getByRole("button", { name: "저장" }));

        await waitFor(() => expect(categoryBody).toEqual({ categoryId: 7 }));
        // 저장 성공 시 모달 닫힘
        await waitFor(() => expect(dialog).not.toBeInTheDocument());
    });

    it("시리즈 안에서 새 작품을 만들면 그 시리즈로 자동 배정한다", async () => {
        let categoryBody: unknown = null;
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })),
            http.get(`${ORIGIN}/api/categories`, () =>
                HttpResponse.json({
                    success: true,
                    data: [{ id: 7, name: "가나다", parentId: null, sortOrder: 1, projectCount: 0, createdAt: "", updatedAt: "" }],
                    error: null,
                }),
            ),
            http.post(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({ success: true, data: serverCard(99, null), error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/99/document`, () =>
                HttpResponse.json({
                    success: true,
                    data: { id: 500, projectId: 99, title: "", body: "{}", wordCount: 0, version: "v1", updatedAt: "2026-06-22T00:00:00Z" },
                    error: null,
                }),
            ),
            http.patch(`${ORIGIN}/api/projects/99/category`, async ({ request }) => {
                categoryBody = await request.json();
                return HttpResponse.json({ success: true, data: { id: 99, categoryId: 7 }, error: null });
            }),
        );

        renderPage();

        // 시리즈 드릴인 → 그 안의 '새 작품' 시작
        await userEvent.click(await screen.findByRole("button", { name: "가나다 열기" }));
        await userEvent.click(screen.getByRole("button", { name: "+ 새 작품 시작하기" }));
        // 생성 모달 — 제목 + 출판 방식(필수) 입력 후 만들기
        await userEvent.type(screen.getByLabelText("제목"), "새 단편");
        await userEvent.click(screen.getByRole("button", { name: /종이 출판/ }));
        await userEvent.click(screen.getByRole("button", { name: "만들기" }));

        await waitFor(() => expect(categoryBody).toEqual({ categoryId: 7 }));
    });

    it("시리즈를 그대로 두면 이동 엔드포인트를 호출하지 않는다", async () => {
        let categoryCalled = false;
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [serverCard(1, 7)], error: null }),
            ),
            http.get(`${ORIGIN}/api/categories`, () =>
                HttpResponse.json({
                    success: true,
                    data: [{ id: 7, name: "가나다", parentId: null, sortOrder: 1, projectCount: 1, createdAt: "", updatedAt: "" }],
                    error: null,
                }),
            ),
            http.patch(`${ORIGIN}/api/projects/1`, () =>
                HttpResponse.json({ success: true, data: serverCard(1, 7), error: null }),
            ),
            http.patch(`${ORIGIN}/api/projects/1/category`, () => {
                categoryCalled = true;
                return HttpResponse.json({ success: true, data: { id: 1, categoryId: 7 }, error: null });
            }),
        );

        renderPage();

        // 작품1 은 시리즈 7 소속 → 그 시리즈로 드릴인해 카드 노출
        await userEvent.click(await screen.findByRole("button", { name: "가나다 열기" }));
        await userEvent.click(await screen.findByRole("button", { name: "작품1 편집" }));
        // 제목만 바꾸고 저장(시리즈 유지)
        const title = screen.getByDisplayValue("작품1");
        await userEvent.type(title, " 수정");
        await userEvent.click(screen.getByRole("button", { name: "저장" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "작품 편집" })).not.toBeInTheDocument());
        expect(categoryCalled).toBe(false);
    });
});
