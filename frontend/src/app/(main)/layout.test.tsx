import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

// 037 — 문의 진입점은 헤더에서 제거되고 마이페이지(사이드 메뉴)로 이동(MypageSidebar.test 가 검증).
describe("BLayout 문의 진입점 제거", () => {
    it("헤더에 문의 링크가 없다", () => {
        renderLayout();
        expect(screen.queryByRole("link", { name: "문의" })).not.toBeInTheDocument();
    });
});
