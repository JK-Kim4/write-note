import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import NewProjectPage from "./page";

/**
 * 새 프로젝트 폼 행위 테스트 (US2) — title 누락 검증 + 생성 후 이동.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("NewProjectPage", () => {
    it("title 누락 시 검증 메시지를 표시하고 생성 요청을 보내지 않는다", async () => {
        let posted = false;
        server.use(
            // 가드의 /me 호출 — 인증된 상태로
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects`, () => {
                posted = true;
                return HttpResponse.json({ success: true, data: { id: 9 }, error: null }, { status: 201 });
            }),
        );
        renderWithClient(<NewProjectPage />);

        await userEvent.click(screen.getByRole("button", { name: "프로젝트 만들기" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("제목을 입력해주세요");
        expect(posted).toBe(false);
    });

    it("title 입력 후 생성 성공 시 /projects/{id} 로 이동한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({ success: true, data: { id: 42, title: "새 작품" }, error: null }, { status: 201 }),
            ),
        );
        renderWithClient(<NewProjectPage />);

        await userEvent.type(screen.getByLabelText("제목 *"), "새 작품");
        await userEvent.click(screen.getByRole("button", { name: "프로젝트 만들기" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/projects/42"));
    });
});
