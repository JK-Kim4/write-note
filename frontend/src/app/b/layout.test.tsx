import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import BLayout from "./layout";

/**
 * B형 레이아웃 네비게이션 항목 검증.
 * 홈(/b)과 작품(/b/library) 항목이 네비에 존재하는지 확인한다.
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/b",
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/guard", () => ({
    useAuthGuard: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
    logout: vi.fn(),
}));

vi.mock("@/stores/preferences", () => ({
    usePreferences: (_selector: (state: { design: string }) => unknown) =>
        _selector({ design: "b" }),
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
    it("네비에 홈(/b)과 작품(/b/library) 항목이 있다", () => {
        renderLayout();
        expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("href", "/b");
        expect(screen.getByRole("link", { name: "작품" })).toHaveAttribute("href", "/b/library");
    });
});
