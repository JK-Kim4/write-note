import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { SignupEmailForm } from "./SignupEmailForm";

/**
 * SignupEmailForm 행위 테스트 (US5) — 가입 성공 안내 이동 + 중복 가입 code 표시.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

async function fillForm() {
    await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
    await userEvent.type(screen.getByLabelText("비밀번호 확인"), "Strong!Pass123");
    await userEvent.click(screen.getByRole("checkbox"));
}

describe("SignupEmailForm", () => {
    it("가입 성공 시 인증 안내(verify-pending)로 이동한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/signup/email`, () =>
                HttpResponse.json(
                    { success: true, data: { userId: 1, email: "writer@example.com", emailVerifySent: true }, error: null },
                    { status: 201 },
                ),
            ),
        );
        renderWithClient(<SignupEmailForm />);

        await fillForm();
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/auth/verify-pending"));
    });

    it("EMAIL_ALREADY_REGISTERED(409) 시 이미 가입된 이메일 메시지를 표시한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/signup/email`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "EMAIL_ALREADY_REGISTERED", message: "x" } },
                    { status: 409 },
                ),
            ),
        );
        renderWithClient(<SignupEmailForm />);

        await fillForm();
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        expect(await screen.findByText(/이미 가입된 이메일/)).toBeInTheDocument();
    });

    it("비밀번호 확인 불일치 시 가입 요청을 보내지 않는다", async () => {
        let posted = false;
        server.use(
            http.post(`${ORIGIN}/api/auth/signup/email`, () => {
                posted = true;
                return HttpResponse.json({ success: true, data: {}, error: null }, { status: 201 });
            }),
        );
        renderWithClient(<SignupEmailForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.type(screen.getByLabelText("비밀번호 확인"), "Different!999");
        await userEvent.click(screen.getByRole("checkbox"));
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        expect(await screen.findByText(/일치하지 않습니다/)).toBeInTheDocument();
        expect(posted).toBe(false);
    });
});
