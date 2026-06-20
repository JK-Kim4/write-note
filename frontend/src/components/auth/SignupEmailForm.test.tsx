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
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보/ }));
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

        await waitFor(() =>
            expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/auth/verify-pending")),
        );
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
        await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
        await userEvent.click(screen.getByRole("checkbox", { name: /개인정보/ }));
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        expect(await screen.findByText(/일치하지 않습니다/)).toBeInTheDocument();
        expect(posted).toBe(false);
    });

    it("약관에 모두 동의하지 않으면 가입 요청을 보내지 않는다", async () => {
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
        await userEvent.type(screen.getByLabelText("비밀번호 확인"), "Strong!Pass123");
        await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/ }));
        // 개인정보처리방침 미동의 상태로 제출
        await userEvent.click(screen.getByRole("button", { name: "가입하기" }));

        expect(await screen.findByText(/모두 동의/)).toBeInTheDocument();
        expect(posted).toBe(false);
    });

    it("이용약관 보기 클릭 시 약관 모달 본문을 표시한다", async () => {
        renderWithClient(<SignupEmailForm />);
        await userEvent.click(screen.getByRole("button", { name: "이용약관 보기" }));
        const dialog = await screen.findByRole("dialog", { name: "이용약관" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(/작성자인 이용자 본인에게 귀속/)).toBeInTheDocument();
    });
});
