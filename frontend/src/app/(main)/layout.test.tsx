import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BLayout from "./layout";

/**
 * B형 레이아웃 네비게이션 항목 + 모달 라우팅 검증.
 * 홈(/)·작품(/library) 네비, 그리고 작품 0개 모달의 "작품 목록은 /library" 회귀 가드.
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

vi.mock("@/lib/lastProject", () => ({
    getLastProject: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/query/useProjects", () => ({
    useProjectCards: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/lib/useModalDismiss", () => ({
    useModalDismiss: vi.fn(),
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

    it("작품 0개에서 집필→새 작품 만들기는 작품 벽(/library?new=1)으로 이동한다", async () => {
        // 대시보드(/)는 ?new=1 을 처리하지 않으므로 작품 벽으로 가야 생성 모달이 열린다(온보딩 회귀 가드).
        renderLayout();
        await userEvent.click(screen.getByRole("button", { name: "집필" }));
        await userEvent.click(screen.getByRole("button", { name: "새 작품 만들기" }));
        expect(pushMock).toHaveBeenCalledWith("/library?new=1");
    });

    it("작품 0개 모달의 '작품 목록' 버튼은 /library 로 이동한다", async () => {
        renderLayout();
        await userEvent.click(screen.getByRole("button", { name: "집필" }));
        await userEvent.click(screen.getByRole("button", { name: "작품 목록" }));
        expect(pushMock).toHaveBeenCalledWith("/library");
    });
});
