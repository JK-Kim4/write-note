import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { ResetNewForm } from "./ResetNewForm";

/**
 * ResetNewForm 행위 테스트 (US5) — token query 로 새 비밀번호 확정 → reset-done 이동.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams("token=reset-token-abc"),
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ResetNewForm", () => {
    it("새 비밀번호 확정 성공 시 reset-done 으로 이동한다", async () => {
        let confirmedToken: string | undefined;
        server.use(
            http.post(`${ORIGIN}/api/auth/password-reset/confirm`, async ({ request }) => {
                const body = (await request.json()) as { token: string; newPassword: string };
                confirmedToken = body.token;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );
        renderWithClient(<ResetNewForm />);

        await userEvent.type(screen.getByLabelText("새 비밀번호"), "Strong!New123");
        await userEvent.type(screen.getByLabelText("새 비밀번호 확인"), "Strong!New123");
        await userEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/reset-done"));
        expect(confirmedToken).toBe("reset-token-abc");
    });
});
