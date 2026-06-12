import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import MemoDeskPage from "./page";

/**
 * 책상 버리기/되돌리기 행위 테스트 (019 US1) — 버리면 목록에서 사라지고 토스트가 뜨며,
 * 되돌리기를 누르면 restore 가 호출된다.
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => "/memos",
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function memo(id: number, body: string) {
    return {
        id,
        body,
        source: "DESKTOP",
        capturedAt: "2026-06-01T00:00:00Z",
        activeProjectAtCapture: null,
        reasonNote: null,
        tags: [],
        projects: [],
    };
}

function memoPage(content: ReturnType<typeof memo>[]) {
    return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
}

const ME = http.get(`${ORIGIN}/api/auth/me`, () =>
    HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
);
const CARDS = http.get(`${ORIGIN}/api/projects/cards`, () =>
    HttpResponse.json({ success: true, data: [], error: null }),
);

describe("MemoDeskPage 버리기/되돌리기", () => {
    it("버리면 목록에서 사라지고 되돌리기 토스트가 뜨며, 되돌리기 시 restore 가 호출된다", async () => {
        let deleted = false;
        let restoreCalled = false;
        server.use(
            ME,
            CARDS,
            http.get(`${ORIGIN}/api/memos`, () =>
                HttpResponse.json({
                    success: true,
                    data: memoPage(deleted ? [] : [memo(7, "버릴 쪽지")]),
                    error: null,
                }),
            ),
            http.delete(`${ORIGIN}/api/memos/7`, () => {
                deleted = true;
                return new HttpResponse(null, { status: 204 });
            }),
            http.post(`${ORIGIN}/api/memos/7/restore`, () => {
                restoreCalled = true;
                deleted = false;
                return HttpResponse.json({ success: true, data: memo(7, "버릴 쪽지"), error: null });
            }),
        );

        const user = userEvent.setup();
        renderWithClient(<MemoDeskPage />);

        // 메모 노출 확인
        expect(await screen.findByText("버릴 쪽지")).toBeInTheDocument();

        // 버리기 → 낙관적 제거 + 토스트
        await user.click(screen.getByRole("button", { name: "쪽지 버리기" }));
        await waitFor(() => expect(screen.queryByText("버릴 쪽지")).not.toBeInTheDocument());
        const undo = await screen.findByRole("button", { name: "되돌리기" });

        // 되돌리기 → restore 호출
        await user.click(undo);
        await waitFor(() => expect(restoreCalled).toBe(true));
    });

    it("연달아 버리면 토스트가 건수로 묶이고, 모두 되돌리기 시 전부 restore 된다 (019 묶음 토스트)", async () => {
        const restored: number[] = [];
        let deletedIds: number[] = [];
        server.use(
            ME,
            CARDS,
            http.get(`${ORIGIN}/api/memos`, () =>
                HttpResponse.json({
                    success: true,
                    data: memoPage(
                        [memo(7, "첫 쪽지"), memo(8, "둘째 쪽지")].filter((m) => !deletedIds.includes(m.id)),
                    ),
                    error: null,
                }),
            ),
            http.delete(`${ORIGIN}/api/memos/:id`, ({ params }) => {
                deletedIds.push(Number(params.id));
                return new HttpResponse(null, { status: 204 });
            }),
            http.post(`${ORIGIN}/api/memos/:id/restore`, ({ params }) => {
                const id = Number(params.id);
                restored.push(id);
                deletedIds = deletedIds.filter((d) => d !== id);
                return HttpResponse.json({ success: true, data: memo(id, "복원"), error: null });
            }),
        );

        const user = userEvent.setup();
        renderWithClient(<MemoDeskPage />);

        await user.click((await screen.findAllByRole("button", { name: "쪽지 버리기" }))[0]);
        await user.click((await screen.findAllByRole("button", { name: "쪽지 버리기" }))[0]);

        // 두 건이 한 토스트로 묶인다
        expect(await screen.findByText("쪽지 2개를 버렸어요.")).toBeInTheDocument();

        // 모두 되돌리기 → 두 건 모두 restore
        await user.click(screen.getByRole("button", { name: "모두 되돌리기" }));
        await waitFor(() => expect(restored.sort()).toEqual([7, 8]));
    });
});
