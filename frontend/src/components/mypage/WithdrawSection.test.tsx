import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { WithdrawSection } from "./WithdrawSection";

/**
 * 회원 탈퇴 모달 행위 — 기존 설정 화면 테스트에서 이관(037, 행위 보존).
 */
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
    usePathname: () => "/mypage/withdraw",
    useSearchParams: () => new URLSearchParams(),
}));

const ORIGIN = "http://localhost:3000";

beforeEach(() => {
    replaceMock.mockClear();
    server.use(
        http.delete(`${ORIGIN}/api/auth/me`, () => HttpResponse.json({ success: true, data: null, error: null })),
    );
});

function renderSection() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <WithdrawSection />
        </QueryClientProvider> as ReactNode,
    );
}

describe("WithdrawSection", () => {
    it("확인 문구 미입력 시 탈퇴 버튼 비활성, 정확 입력 시 활성", async () => {
        renderSection();
        await userEvent.click(screen.getByRole("button", { name: "회원 탈퇴" }));
        const confirmBtn = screen.getByRole("button", { name: "탈퇴하기" });
        expect(confirmBtn).toBeDisabled();
        await userEvent.type(screen.getByLabelText("확인 문구"), "탈퇴합니다");
        expect(confirmBtn).toBeEnabled();
    });
});
