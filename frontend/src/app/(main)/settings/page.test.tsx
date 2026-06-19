import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import BSettingsPage from "./page";

/**
 * 설정 페이지 행위 테스트 — 회원 탈퇴 모달 (Task 5).
 * 시스템 경계(HTTP)만 msw mock.
 */

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    usePathname: () => "/settings",
    useSearchParams: () => new URLSearchParams(),
}));

const ORIGIN = "http://localhost:3000";

beforeEach(() => {
    replaceMock.mockClear();
    // /api/auth/me 기본 stub
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({
                success: true,
                data: { id: 1, email: "test@example.com", kakaoLinked: false },
                error: null,
            }),
        ),
    );
});

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BSettingsPage />
        </QueryClientProvider> as ReactNode,
    );
}

describe("BSettingsPage 회원 탈퇴 모달 행위", () => {
    it("회원 탈퇴 모달: 문구 미입력 시 삭제 버튼 비활성, 정확 입력 시 활성", async () => {
        renderPage();
        await userEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
        const confirmBtn = screen.getByRole("button", { name: "탈퇴하기" });
        expect(confirmBtn).toBeDisabled();
        await userEvent.type(screen.getByLabelText("확인 문구"), "탈퇴합니다");
        expect(confirmBtn).toBeEnabled();
    });
});
