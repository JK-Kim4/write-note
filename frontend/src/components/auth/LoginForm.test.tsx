import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { LoginForm } from "./LoginForm";

/**
 * LoginForm 행위 테스트 (US1) — 성공 시 앱 홈(/) 이동 + 실패 code 메시지.
 * HTTP 경계만 msw mock, next/navigation 은 시스템 경계로 mock.
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

afterEach(() => {
    pushMock.mockClear();
    localStorage.clear();
});

describe("LoginForm", () => {
    it("로그인 성공 시 앱 홈(/)으로 이동한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/login`, () =>
                HttpResponse.json({ success: true, data: { accessToken: "x" }, error: null }),
            ),
        );
        renderWithClient(<LoginForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.click(screen.getByRole("button", { name: "로그인" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    });

    it("LOGIN_FAILED 응답 시 한국어 에러 메시지를 표시한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/login`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "LOGIN_FAILED", message: "x" } },
                    { status: 401 },
                ),
            ),
        );
        renderWithClient(<LoginForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "wrong-pass");
        await userEvent.click(screen.getByRole("button", { name: "로그인" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("올바르지 않습니다");
    });

    it("EMAIL_NOT_VERIFIED 응답 시 인증 메일 재발송 버튼을 노출하고 클릭 시 재발송 API를 호출한다", async () => {
        let resendCalled = false;
        server.use(
            http.post(`${ORIGIN}/api/auth/login`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "EMAIL_NOT_VERIFIED", message: "x" } },
                    { status: 401 },
                ),
            ),
            http.post(`${ORIGIN}/api/auth/resend-verification`, () => {
                resendCalled = true;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );
        renderWithClient(<LoginForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.click(screen.getByRole("button", { name: "로그인" }));

        const resendButton = await screen.findByRole("button", { name: "인증 메일 재발송" });
        await userEvent.click(resendButton);

        await waitFor(() => expect(resendCalled).toBe(true));
    });

    it("이메일 기억하기 체크 후 로그인 성공 시 이메일을 localStorage에 저장한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/login`, () =>
                HttpResponse.json({ success: true, data: { accessToken: "x" }, error: null }),
            ),
        );
        renderWithClient(<LoginForm />);

        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.click(screen.getByLabelText("이메일 기억하기"));
        await userEvent.click(screen.getByRole("button", { name: "로그인" }));

        await waitFor(() =>
            expect(localStorage.getItem("writenote.rememberedEmail.v1")).toBe("writer@example.com"),
        );
    });

    it("이메일 기억하기 미체크로 로그인 성공 시 저장된 이메일을 삭제한다", async () => {
        localStorage.setItem("writenote.rememberedEmail.v1", "old@example.com");
        server.use(
            http.post(`${ORIGIN}/api/auth/login`, () =>
                HttpResponse.json({ success: true, data: { accessToken: "x" }, error: null }),
            ),
        );
        renderWithClient(<LoginForm />);

        // 마운트 복원으로 체크가 켜지므로 끈다.
        await userEvent.clear(screen.getByLabelText("이메일"));
        await userEvent.type(screen.getByLabelText("이메일"), "writer@example.com");
        const remember = screen.getByLabelText("이메일 기억하기");
        if ((remember as HTMLInputElement).checked) await userEvent.click(remember);
        await userEvent.type(screen.getByLabelText("비밀번호"), "Strong!Pass123");
        await userEvent.click(screen.getByRole("button", { name: "로그인" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
        expect(localStorage.getItem("writenote.rememberedEmail.v1")).toBeNull();
    });

    it("저장된 이메일이 있으면 마운트 시 이메일칸을 복원하고 체크박스를 켠다", async () => {
        localStorage.setItem("writenote.rememberedEmail.v1", "saved@example.com");
        renderWithClient(<LoginForm />);

        await waitFor(() =>
            expect(screen.getByLabelText("이메일")).toHaveValue("saved@example.com"),
        );
        expect(screen.getByLabelText("이메일 기억하기")).toBeChecked();
    });
});
