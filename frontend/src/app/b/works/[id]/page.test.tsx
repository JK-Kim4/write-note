import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import BWorkDetailPage from "./page";

/**
 * B형 집필실 /b/works/[id] — 에러 상태 복귀 링크가 /b/library 를 가리키는지 검증.
 * 라우트 이동(refactor: 작품 벽 /b → /b/library) 회귀 방지.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/b/works/1",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ id: "1" }),
}));

const ORIGIN = "http://localhost:3000";

function stubAuthed() {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
        http.post(`${ORIGIN}/api/projects/:id/work-sessions/start`, () =>
            HttpResponse.json({ success: true, data: { sessionId: 1 }, error: null }),
        ),
        http.post(`${ORIGIN}/api/projects/:id/work-sessions/end`, () =>
            HttpResponse.json({ success: true, data: null, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/:id/memos`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
    );
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BWorkDetailPage />
        </QueryClientProvider> as ReactNode,
    );
}

describe("BWorkDetailPage — 복귀 링크", () => {
    it("문서 로드 에러 시 '작품 목록으로' 링크가 /b/library 를 가리킨다", async () => {
        stubAuthed();
        server.use(
            http.get(`${ORIGIN}/api/projects/1`, () => HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: "없음" } }, { status: 404 })),
            http.get(`${ORIGIN}/api/projects/1/document`, () => HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: "없음" } }, { status: 404 })),
        );

        renderPage();

        const link = await screen.findByRole("link", { name: "작품 목록으로" });
        expect(link).toHaveAttribute("href", "/b/library");
    });
});
