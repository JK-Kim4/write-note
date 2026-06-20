import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { OnboardingTour } from "./OnboardingTour";

/**
 * OnboardingTour 행위 테스트.
 * driver.js 는 시스템 경계(DOM 오버레이)로 mock — config 를 캡처해 onDestroyed 콜백을 직접 발화.
 * HTTP 는 msw.
 */

const driveMock = vi.fn();
const destroyMock = vi.fn();
let lastConfig: { onDestroyed?: () => void } | null = null;

vi.mock("driver.js", () => ({
    driver: (config: { onDestroyed?: () => void }) => {
        lastConfig = config;
        return { drive: driveMock, destroy: destroyMock };
    },
}));

const ORIGIN = "http://localhost:3000";

function settingsResponse(settings: Record<string, string>) {
    return http.get(`${ORIGIN}/api/settings`, () =>
        HttpResponse.json({ success: true, data: { settings }, error: null }),
    );
}

function renderTour(ui: ReactNode = <OnboardingTour />) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => {
    driveMock.mockClear();
    destroyMock.mockClear();
    lastConfig = null;
});

describe("OnboardingTour", () => {
    it("온보딩 미완료(설정 키 부재) 시 가이드 투어를 시작한다", async () => {
        server.use(settingsResponse({}));

        renderTour();

        await waitFor(() => expect(driveMock).toHaveBeenCalled());
    });

    it("이미 완료(onboardingCompleted=true) 시 가이드를 시작하지 않는다", async () => {
        let getCalled = false;
        server.use(
            http.get(`${ORIGIN}/api/settings`, () => {
                getCalled = true;
                return HttpResponse.json(
                    { success: true, data: { settings: { onboardingCompleted: "true" } }, error: null },
                );
            }),
        );

        renderTour();

        await waitFor(() => expect(getCalled).toBe(true)); // 설정 로드됨
        await Promise.resolve(); // effect flush
        expect(driveMock).not.toHaveBeenCalled();
    });

    it("가이드 종료(onDestroyed) 시 onboardingCompleted=true 를 저장한다", async () => {
        let putBody: { settings?: Record<string, string> } | null = null;
        server.use(
            settingsResponse({}),
            http.put(`${ORIGIN}/api/settings`, async ({ request }) => {
                putBody = (await request.json()) as { settings: Record<string, string> };
                return HttpResponse.json({ success: true, data: { settings: putBody.settings }, error: null });
            }),
        );

        renderTour();

        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        // 완료·건너뛰기 모두 수렴하는 driver onDestroyed 콜백을 직접 발화
        lastConfig?.onDestroyed?.();

        await waitFor(() => expect(putBody).toEqual({ settings: { onboardingCompleted: "true" } }));
    });

    it("종료 후 같은 세션에서 홈을 재방문(재마운트)해도 다시 시작하지 않는다", async () => {
        server.use(
            settingsResponse({}),
            http.put(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json(
                    { success: true, data: { settings: { onboardingCompleted: "true" } }, error: null },
                ),
            ),
        );
        // staleTime Infinity = 재마운트 시 refetch 안 함(완료 후 서버가 true 를 주는 실환경 근사) →
        // 캐시 갱신이 없으면 stale 미완료 캐시로 재시작하는 버그가 드러난다.
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

        const first = render(
            <QueryClientProvider client={client}>
                <OnboardingTour />
            </QueryClientProvider>,
        );
        await waitFor(() => expect(driveMock).toHaveBeenCalledTimes(1));

        // 종료 → 저장 + 캐시 갱신
        lastConfig?.onDestroyed?.();
        await waitFor(() =>
            expect(client.getQueryData(["settings"])).toMatchObject({ onboardingCompleted: "true" }),
        );

        // 홈 떠났다 복귀 = 언마운트 → 리마운트
        first.unmount();
        driveMock.mockClear();
        render(
            <QueryClientProvider client={client}>
                <OnboardingTour />
            </QueryClientProvider>,
        );
        await Promise.resolve();

        expect(driveMock).not.toHaveBeenCalled();
    });
});
