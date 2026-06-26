/**
 * OnboardingTour 완료 분기 — 축하 애니메이션 연결 테스트.
 *
 * 검증 대상:
 *   - step 5(보드, 044) "바로 시작"(onPrevClick) 클릭 → OnboardingCelebration 렌더
 *   - "더 보기"(onNextClick) 클릭 → OnboardingCelebration 미렌더(라이브러리로 이동)
 *   - ESC/onCloseClick 클릭 → OnboardingCelebration 미렌더
 *   - OnboardingCelebration onDone 호출 → 컴포넌트 unmount(showCelebration false)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { OnboardingTour } from "../OnboardingTour";

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

function renderTour() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    return render(<OnboardingTour />, { wrapper: Wrapper });
}

beforeEach(() => {
    server.use(
        settingsResponse({}),
        http.put(`${ORIGIN}/api/settings`, () =>
            HttpResponse.json({ success: true, data: { settings: { onboardingCompleted: "true" } }, error: null }),
        ),
    );
});

afterEach(() => {
    driveMock.mockClear();
    destroyMock.mockClear();
    pushMock.mockClear();
    capturedConfig = null;
    sessionStorage.clear();
});

describe("OnboardingTour — 축하 애니메이션 연결", () => {
    it("step 5(보드, 044) '바로 시작'(onPrevClick) 클릭 → OnboardingCelebration 렌더", async () => {
        renderTour();
        // settings 로드 후 driver.drive() 호출까지 대기
        await waitFor(() => expect(driveMock).toHaveBeenCalled());

        const steps = capturedConfig?.steps as Array<{ popover?: { onPrevClick?: () => void } }>;
        act(() => {
            steps?.[4]?.popover?.onPrevClick?.();
        });

        expect(screen.getByText("작업실이 준비됐어요")).toBeDefined();
    });

    it("'더 보기'(onNextClick) 클릭 → OnboardingCelebration 미렌더(라이브러리 이동)", async () => {
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());

        const steps = capturedConfig?.steps as Array<{ popover?: { onNextClick?: () => void } }>;
        act(() => {
            steps?.[4]?.popover?.onNextClick?.();
        });

        // 라이브러리로 이동 — 축하 없음
        expect(pushMock).toHaveBeenCalledWith("/library");
        expect(screen.queryByText("작업실이 준비됐어요")).toBeNull();
    });

    it("onCloseClick(ESC/×) 클릭 → OnboardingCelebration 미렌더", async () => {
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());

        act(() => {
            capturedConfig?.onCloseClick?.();
        });

        expect(screen.queryByText("작업실이 준비됐어요")).toBeNull();
    });

    it("OnboardingCelebration onDone 호출 후 축하 화면 사라짐", async () => {
        renderTour();
        await waitFor(() => expect(driveMock).toHaveBeenCalled());

        // 바로 시작 클릭 → 축하 표시
        const steps = capturedConfig?.steps as Array<{ popover?: { onPrevClick?: () => void } }>;
        act(() => {
            steps?.[4]?.popover?.onPrevClick?.();
        });

        expect(screen.getByText("작업실이 준비됐어요")).toBeDefined();

        // 축하 화면 클릭(onDone 호출) → 사라짐
        act(() => {
            screen.getByRole("status").click();
        });

        expect(screen.queryByText("작업실이 준비됐어요")).toBeNull();
    });
});
