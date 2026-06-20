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
    localStorage.removeItem("wn:prefsOwner");
    usePreferences.setState({ theme: "system", writingMode: "editor", manuscriptSize: 400, dailyGoalMinutes: 60 });
});

afterEach(() => {
    usePreferences.setState({ theme: "system", writingMode: "editor", manuscriptSize: 400, dailyGoalMinutes: 60 });
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

    it("서버의 dailyGoalMinutes 를 store 에 주입한다 (028 US2)", async () => {
        server.use(
            ME,
            http.get(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({
                    success: true,
                    data: { settings: { dailyGoalMinutes: "90" } },
                    error: null,
                }),
            ),
        );

        renderWithClient(<PreferencesSync />);

        await waitFor(() => expect(usePreferences.getState().dailyGoalMinutes).toBe(90));
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

/**
 * 계정 전환 격리 (019 버그픽스 F) — 로그아웃→다른 계정 로그인이 SPA 내 전환(풀 리로드 없음)이라
 * 컴포넌트가 살아있는 채 me 가 바뀐다. 사용자 단위로 재하이드레이트하고, 이전 계정 로컬값이
 * 새 계정 서버로 시딩되지 않아야 한다.
 */
describe("PreferencesSync 계정 전환 (버그 F)", () => {
    function setupSwitchableServer(opts: {
        settingsFor: (userId: number) => Record<string, string>;
        onPut?: (settings: Record<string, string>) => void;
    }) {
        const state = { currentUser: 1 };
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({
                    success: true,
                    data: { userId: state.currentUser, email: "u@b.com" },
                    error: null,
                }),
            ),
            http.get(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({
                    success: true,
                    data: { settings: opts.settingsFor(state.currentUser) },
                    error: null,
                }),
            ),
            http.put(`${ORIGIN}/api/settings`, async ({ request }) => {
                const body = (await request.json()) as { settings: Record<string, string> };
                opts.onPut?.(body.settings);
                return HttpResponse.json({ success: true, data: { settings: body.settings }, error: null });
            }),
        );
        return state;
    }

    it("계정이 바뀌면 새 계정의 서버 설정으로 재하이드레이트한다", async () => {
        const state = setupSwitchableServer({
            settingsFor: (userId) => (userId === 1 ? { theme: "dark" } : { theme: "light" }),
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <PreferencesSync />
            </QueryClientProvider>,
        );
        await waitFor(() => expect(usePreferences.getState().theme).toBe("dark"));

        state.currentUser = 2;
        await client.invalidateQueries({ queryKey: ["auth", "me"] });

        await waitFor(() => expect(usePreferences.getState().theme).toBe("light"));
    });

    it("계정 전환 후 서버 설정이 없으면 이전 계정 로컬값 대신 기본값으로 리셋·시딩한다", async () => {
        const puts: Array<Record<string, string>> = [];
        const state = setupSwitchableServer({
            settingsFor: (userId): Record<string, string> =>
                userId === 1 ? { theme: "dark", manuscriptSize: "200" } : {},
            onPut: (settings) => puts.push(settings),
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <PreferencesSync />
            </QueryClientProvider>,
        );
        // 계정 1 — 서버값(dark/200) 주입 완료
        await waitFor(() => expect(usePreferences.getState().theme).toBe("dark"));
        expect(usePreferences.getState().manuscriptSize).toBe(200);

        state.currentUser = 2;
        await client.invalidateQueries({ queryKey: ["auth", "me"] });

        // 계정 2 시딩은 계정 1 의 dark/200 이 아닌 기본값이어야 한다
        await waitFor(() => expect(puts.length).toBeGreaterThan(0));
        expect(puts.at(-1)).toMatchObject({ theme: "system", manuscriptSize: "400" });
        expect(usePreferences.getState().theme).toBe("system");
    });
});
