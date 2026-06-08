import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import ProjectDetailPage from "./page";

/**
 * 상세 페이지 lifecycle 테스트 (US3) — 삭제 확인 모달 → 삭제 → 홈 이동.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "42" }),
    useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const PROJECT = {
    id: 42,
    title: "작품",
    genre: null,
    targetLength: null,
    toneNotes: null,
    synopsis: null,
    worldNotes: null,
    archivedAt: null,
    createdAt: "2026-05-30T00:00:00Z",
    updatedAt: "2026-05-30T00:00:00Z",
};

describe("ProjectDetailPage", () => {
    it("삭제 확인 모달에서 삭제를 확정하면 DELETE 후 홈으로 이동한다", async () => {
        let deleted = false;
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/42`, () =>
                HttpResponse.json({ success: true, data: PROJECT, error: null }),
            ),
            http.delete(`${ORIGIN}/api/projects/42`, () => {
                deleted = true;
                return new HttpResponse(null, { status: 204 });
            }),
        );
        renderWithClient(<ProjectDetailPage />);

        await userEvent.click(await screen.findByRole("button", { name: "삭제" }));

        const dialog = await screen.findByRole("dialog");
        await userEvent.click(within(dialog).getByRole("button", { name: "삭제" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
        expect(deleted).toBe(true);
    });
});
