import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { OnboardingTour } from "./OnboardingTour";

/**
 * OnboardingTour 행위 테스트 (v2).
 *
 * driver.js — 시스템 경계(DOM 오버레이 라이브러리) mock. config 를 캡처해 콜백 직접 발화.
 * useRouter — next/navigation 시스템 경계 mock.
 * 설정 HTTP client — msw.
 * sessionStorage — 브라우저 API, 테스트 환경(jsdom)에서 실제 사용(mock 불필요).
 *
 * 검증 대상(행위):
 *   - 미완료 시 자동 시작 / 완료 시 미시작
 *   - 단계 순서(인트로 3 + 메뉴 2, 총 5 step — 044 보드 중심)
 *   - 모든 종료 경로에서 putSettings({onboardingCompleted:"true"}) 1회
 *   - "바로 시작" = 완료 저장 + 투어 종료(추가 navigate 없음)
 *   - "더 보기" = 완료 저장 + sessionStorage 핸드오프 set + router.push("/library")
 */

// ── driver.js mock ──────────────────────────────────────────────────────────
const driveMock = vi.fn();
const destroyMock = vi.fn();
let capturedConfig: {
    onDestroyed?: () => void;
    steps?: unknown[];
    onCloseClick?: () => void;
} | null = null;

vi.mock("driver.js", () => ({
    driver: (config: typeof capturedConfig) => {
        capturedConfig = config;
        return { drive: driveMock, destroy: destroyMock };
    },
}));

// ── next/navigation mock ─────────────────────────────────────────────────────
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

// ── helpers ─────────────────────────────────────────────────────────────────
const ORIGIN = "http://localhost:3000";

function settingsResponse(settings: Record<string, string>) {
    return http.get(`${ORIGIN}/api/settings`, () =>
        HttpResponse.json({ success: true, data: { settings }, error: null }),
    );
}

function renderTour(staleTime?: number) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: staleTime ?? 0 } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const result = render(<OnboardingTour />, { wrapper: Wrapper });
    return { client, ...result };
}

afterEach(() => {
    driveMock.mockClear();
    destroyMock.mockClear();
    pushMock.mockClear();
    capturedConfig = null;
    sessionStorage.clear();
});

// ── 기존 회귀 테스트(기존 027 행위, v2 에서도 보존) ──────────────────────────────

describe("OnboardingTour — 기본 시작/미시작 행위", () => {
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
                return HttpResponse.json({
                    success: true,
                    data: { settings: { onboardingCompleted: "true" } },
                    error: null,
                });
            }),
        );
        renderTour();
        await waitFor(() => expect(getCalled).toBe(true));
        await Promise.resolve();
        expect(driveMock).not.toHaveBeenCalled();
    });

    it("종료(onDestroyed) 시 onboardingCompleted=true 를 저장한다", async () => {
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
        capturedConfig?.onDestroyed?.();
        await waitFor(() => expect(putBody).toEqual({ settings: { onboardingCompleted: "true" } }));
    });

    it("종료 후 같은 세션에서 재마운트해도 다시 시작하지 않는다", async () => {
        server.use(
            settingsResponse({}),
            http.put(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({
                    success: true,
                    data: { settings: { onboardingCompleted: "true" } },
                    error: null,
                }),
            ),
        );
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
        });
        const first = render(
            <QueryClientProvider client={client}>
                <OnboardingTour />
            </QueryClientProvider>,
        );
        await waitFor(() => expect(driveMock).toHaveBeenCalledTimes(1));
        capturedConfig?.onDestroyed?.();
        await waitFor(() =>
            expect(client.getQueryData(["settings"])).toMatchObject({ onboardingCompleted: "true" }),
        );
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

// ── v2 신규 행위 테스트 ─────────────────────────────────────────────────────

describe("OnboardingTour v2 — 단계 구성", () => {
    it("총 5 단계(인트로 3 + 메뉴 2)를 driver 에 전달한다(044 보드 중심 — 메모·인물 메뉴 폐기)", async () => {
        server.use(settingsResponse({}));
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        // steps 배열 길이가 5
        expect(Array.isArray(capturedConfig?.steps)).toBe(true);
        expect(capturedConfig?.steps).toHaveLength(5);
    });

    it("인트로 3 단계는 element 없는 중앙 popover 이다", async () => {
        server.use(settingsResponse({}));
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        const steps = capturedConfig?.steps as Array<{ element?: unknown; popover?: unknown }>;
        // 처음 3개에 element 없음(undefined 또는 미포함)
        expect(steps[0]).not.toHaveProperty("element");
        expect(steps[1]).not.toHaveProperty("element");
        expect(steps[2]).not.toHaveProperty("element");
    });

    it("메뉴 2 단계는 nav-works / nav-boards 순서로 타겟을 가진다(044 보드 중심 — 메모·인물 메뉴 폐기)", async () => {
        server.use(settingsResponse({}));
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        const steps = capturedConfig?.steps as Array<{ element?: string; popover?: unknown }>;
        expect(steps[3].element).toBe('[data-tour="nav-works"]');
        expect(steps[4].element).toBe('[data-tour="nav-boards"]');
        expect(steps).toHaveLength(5);
    });
});

describe("OnboardingTour v2 — 모든 종료 경로에서 완료 저장", () => {
    beforeEach(() => {
        server.use(
            settingsResponse({}),
            http.put(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null }),
            ),
        );
    });

    it("onDestroyed 콜백(끝내기/건너뛰기/ESC/배경) 시 저장한다", async () => {
        let putCount = 0;
        server.use(
            http.put(`${ORIGIN}/api/settings`, () => {
                putCount++;
                return HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null });
            }),
        );
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        capturedConfig?.onDestroyed?.();
        await waitFor(() => expect(putCount).toBeGreaterThanOrEqual(1));
        // 중복 저장 없음(1회)
        expect(putCount).toBe(1);
    });
});

describe("OnboardingTour v2 — 분기", () => {
    beforeEach(() => {
        server.use(
            settingsResponse({}),
            http.put(`${ORIGIN}/api/settings`, () =>
                HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null }),
        ),
        );
    });

    it("step 5(보드, 044) 은 [바로 시작]/[더 보기] 2개 버튼을 명시 렌더한다(× 의존 아님)", async () => {
        server.use(settingsResponse({}));
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        const steps = capturedConfig?.steps as Array<{
            popover?: { showButtons?: readonly string[]; prevBtnText?: string; nextBtnText?: string };
        }>;
        const branch = steps?.[4]?.popover;
        expect(branch?.showButtons).toEqual(["previous", "next"]);
        expect(branch?.prevBtnText).toBe("바로 시작");
        expect(branch?.nextBtnText).toBe("더 보기");
    });

    it('"바로 시작" 버튼(step 5(보드, 044) previous) 클릭 시 완료 저장 후 router.push 호출하지 않는다', async () => {
        let putCount = 0;
        server.use(
            http.put(`${ORIGIN}/api/settings`, () => {
                putCount++;
                return HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null });
            }),
        );
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        // "바로 시작" = step 5(보드, 044) 의 previous 슬롯 핸들러(뒤로 가지 않고 완료+종료)
        const steps = capturedConfig?.steps as Array<{ popover?: { onPrevClick?: () => void } }>;
        steps?.[4]?.popover?.onPrevClick?.();
        await waitFor(() => expect(putCount).toBeGreaterThanOrEqual(1));
        expect(pushMock).not.toHaveBeenCalled();
    });

    it('"더 보기" 선택 시 완료 저장 + sessionStorage 핸드오프 set + router.push("/library") 호출', async () => {
        let putCount = 0;
        server.use(
            http.put(`${ORIGIN}/api/settings`, () => {
                putCount++;
                return HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null });
            }),
        );
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());
        // "더 보기" 내부 handler 는 OnboardingTour.tsx 가 step 5(보드, 044)의 onNextClick 에 주입
        // capturedConfig 에서 꺼내 발화
        const steps = capturedConfig?.steps as Array<{
            popover?: { onNextClick?: () => void };
        }>;
        // step 5(보드, 044)(index 4)의 onNextClick 이 "더 보기" 핸들러
        steps?.[4]?.popover?.onNextClick?.();
        await waitFor(() => expect(putCount).toBeGreaterThanOrEqual(1));
        expect(sessionStorage.getItem("writenote.onboarding.stage.v1")).toBe("library");
        expect(pushMock).toHaveBeenCalledWith("/library");
    });
});
