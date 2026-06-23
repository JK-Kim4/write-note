import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BLayout from "./layout";

/**
 * B형 레이아웃 네비게이션 항목 검증. 홈(/)·작품(/library) 네비 + 문의 진입점.
 * 집필 진입은 별도 nav 메뉴 없이 "작품"(/library)에서 작품을 열어 들어간다.
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/guard", () => ({
    useAuthGuard: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
    logout: vi.fn(),
}));

vi.mock("@/stores/preferences", () => ({
    usePreferences: vi.fn(),
    useIsPreferencesHydrated: () => true,
}));

function renderLayout() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BLayout>
                <div />
            </BLayout>
        </QueryClientProvider> as ReactNode,
    );
}

describe("BLayout 네비게이션", () => {
    beforeEach(() => pushMock.mockClear());

    it("네비에 홈(/)과 작품(/library) 항목이 있다", () => {
        renderLayout();
        expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "작품" })).toHaveAttribute("href", "/library");
    });

    it("상단 네비에 '집필' 메뉴가 없다", () => {
        renderLayout();
        expect(screen.queryByRole("button", { name: "집필" })).not.toBeInTheDocument();
    });
});

// 031 — 서비스 내 문의 진입점(헤더 전역). 데스크탑 헤더 + 모바일 햄버거 메뉴 양쪽.
describe("BLayout 문의 진입점", () => {
    it("헤더에 문의 링크(/contact)가 있다", () => {
        renderLayout();
        expect(screen.getByRole("link", { name: "문의" })).toHaveAttribute("href", "/contact");
    });

    it("모바일 햄버거 메뉴를 열면 문의 링크(/contact)가 보인다", async () => {
        renderLayout();
        await userEvent.click(screen.getByRole("button", { name: "메뉴" }));
        // 데스크탑 헤더 + 모바일 메뉴 양쪽에 노출 → 2개, 모두 /contact.
        const links = screen.getAllByRole("link", { name: "문의" });
        expect(links).toHaveLength(2);
        links.forEach((link) => expect(link).toHaveAttribute("href", "/contact"));
    });
});
