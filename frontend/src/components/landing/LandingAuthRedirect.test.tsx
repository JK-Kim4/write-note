import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { usePreferences } from "@/stores/preferences";
import { LandingAuthRedirect } from "./LandingAuthRedirect";

const ORIGIN = "http://localhost:3000";
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
}));
vi.mock("@/stores/preferences", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/stores/preferences")>();
    return { ...actual, useIsPreferencesHydrated: () => true };
});

function wrap(node: ReactNode) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("LandingAuthRedirect", () => {
    beforeEach(() => {
        replaceMock.mockClear();
        usePreferences.setState({ design: "default" });
    });

    it("로그인(A 디자인) 상태면 /home 으로 replace 한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
        );
        usePreferences.setState({ design: "default" });
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/home"));
    });

    it("로그인(B 디자인) 상태면 /b 로 replace 한다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
        );
        usePreferences.setState({ design: "b" });
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/b"));
    });

    it("비로그인(401) 이면 replace 하지 않는다", async () => {
        server.use(http.get(`${ORIGIN}/api/auth/me`, () => new HttpResponse(null, { status: 401 })));
        render(wrap(<LandingAuthRedirect />));
        await waitFor(() => {});
        expect(replaceMock).not.toHaveBeenCalled();
    });
});
