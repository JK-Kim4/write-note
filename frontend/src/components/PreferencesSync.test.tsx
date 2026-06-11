import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { usePreferences } from "@/stores/preferences";
import { PreferencesSync } from "./PreferencesSync";

/**
 * 환경설정 서버 동기화 (019 US2) — 서버값 주입 / 빈 응답 시 로컬값 시딩 / 변경 시 PUT.
 */

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const ME = http.get(`${ORIGIN}/api/auth/me`, () =>
    HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
);

beforeEach(() => {
    usePreferences.setState({ theme: "system", writingMode: "editor", manuscriptSize: 400 });
});

afterEach(() => {
    usePreferences.setState({ theme: "system", writingMode: "editor", manuscriptSize: 400 });
});

describe("PreferencesSync", () => {
    it("서버에 저장된 설정을 store 에 주입한다", async () => {
        server.use(
            ME,
            http.get(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({
                    success: true,
                    data: { settings: { theme: "dark", writingMode: "manuscript", manuscriptSize: "1000" } },
                    error: null,
                }),
            ),
        );

        renderWithClient(<PreferencesSync />);

        await waitFor(() => expect(usePreferences.getState().theme).toBe("dark"));
        expect(usePreferences.getState().writingMode).toBe("manuscript");
        expect(usePreferences.getState().manuscriptSize).toBe(1000);
    });

    it("서버 설정이 없으면 현재 로컬값을 시딩 PUT 한다", async () => {
        let seeded: Record<string, string> | null = null;
        usePreferences.setState({ theme: "dark", writingMode: "editor", manuscriptSize: 200 });
        server.use(
            ME,
            http.get(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({ success: true, data: { settings: {} }, error: null }),
            ),
            http.put(`${ORIGIN}/api/settings`, async ({ request }) => {
                const body = (await request.json()) as { settings: Record<string, string> };
                seeded = body.settings;
                return HttpResponse.json({ success: true, data: { settings: body.settings }, error: null });
            }),
        );

        renderWithClient(<PreferencesSync />);

        await waitFor(() => expect(seeded).not.toBeNull());
        expect(seeded).toMatchObject({ theme: "dark", manuscriptSize: "200" });
    });

    it("store 변경 시 서버에 PUT 한다", async () => {
        let lastPut: Record<string, string> | null = null;
        // 구별되는 서버값(light)으로 hydrate 완료를 관측 → 이후 사용자 변경만 PUT 됨(에코 아님).
        server.use(
            ME,
            http.get(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({ success: true, data: { settings: { theme: "light" } }, error: null }),
            ),
            http.put(`${ORIGIN}/api/settings`, async ({ request }) => {
                const body = (await request.json()) as { settings: Record<string, string> };
                lastPut = body.settings;
                return HttpResponse.json({ success: true, data: { settings: body.settings }, error: null });
            }),
        );

        renderWithClient(<PreferencesSync />);
        // hydrate 완료 = store 가 서버값(light)로 바뀜 → applyingRef 해제 보장
        await waitFor(() => expect(usePreferences.getState().theme).toBe("light"));

        usePreferences.getState().setTheme("dark");

        await waitFor(() => expect(lastPut).not.toBeNull(), { timeout: 2000 });
        expect(lastPut).toMatchObject({ theme: "dark" });
    });
});
