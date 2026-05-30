import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import ProjectEditPage from "./page";

/**
 * 편집 폼 행위 테스트 (US3) — 기존 메타 초기화 + 부분 수정 후 상세 복귀.
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
    title: "원제목",
    genre: "판타지",
    targetLength: 1000,
    toneNotes: null,
    synopsis: null,
    worldNotes: null,
    archivedAt: null,
    createdAt: "2026-05-30T00:00:00Z",
    updatedAt: "2026-05-30T00:00:00Z",
};

describe("ProjectEditPage", () => {
    it("기존 메타로 초기화하고 제목 수정 후 저장하면 상세로 복귀한다", async () => {
        let patchedTitle: string | undefined;
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/42`, () =>
                HttpResponse.json({ success: true, data: PROJECT, error: null }),
            ),
            http.patch(`${ORIGIN}/api/projects/42`, async ({ request }) => {
                const body = (await request.json()) as { title: string };
                patchedTitle = body.title;
                return HttpResponse.json({ success: true, data: PROJECT, error: null });
            }),
        );
        renderWithClient(<ProjectEditPage />);

        const titleInput = await screen.findByLabelText("제목 *");
        await waitFor(() => expect(titleInput).toHaveValue("원제목"));

        await userEvent.clear(titleInput);
        await userEvent.type(titleInput, "새제목");
        await userEvent.click(screen.getByRole("button", { name: "저장" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/projects/42"));
        expect(patchedTitle).toBe("새제목");
    });
});
