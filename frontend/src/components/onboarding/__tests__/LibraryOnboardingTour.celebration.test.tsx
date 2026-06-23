/**
 * LibraryOnboardingTour 완료 분기 — 축하 애니메이션 연결 테스트.
 *
 * 검증 대상:
 *   - 마지막 step에서 완료(onNextClick 후 onDestroyed) → OnboardingCelebration 렌더
 *   - 중도 이탈(onCloseClick/×) → OnboardingCelebration 미렌더
 *   - onDestroyed 단독(ESC) → OnboardingCelebration 미렌더
 */

import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryOnboardingTour } from "../LibraryOnboardingTour";

// ── driver.js mock ───────────────────────────────────────────────────────────
// driver 인스턴스 생성마다 갱신되는 capturedConfig.
// 각 테스트에서 새 render → startedRef reset 없이 driver 재실행이 일어나지 않으므로
// capturedConfig 는 afterEach 에서 null 로 초기화한다.

const driveMock = vi.fn();
const destroyMock = vi.fn();
let capturedConfig: {
    onDestroyed?: () => void;
    onCloseClick?: () => void;
    steps?: unknown[];
} | null = null;

vi.mock("driver.js", () => ({
    driver: (config: typeof capturedConfig) => {
        capturedConfig = config;
        return { drive: driveMock, destroy: destroyMock };
    },
}));

// ── helpers ──────────────────────────────────────────────────────────────────
const HANDOFF_KEY = "writenote.onboarding.stage.v1";

/** 타겟 요소 두 개를 document.body 에 삽입하고 cleanup 함수를 반환. */
function insertTargets() {
    const seriesBtn = document.createElement("button");
    seriesBtn.setAttribute("data-tour", "new-series");
    const workBtn = document.createElement("button");
    workBtn.setAttribute("data-tour", "new-work-root");
    document.body.appendChild(seriesBtn);
    document.body.appendChild(workBtn);
    return () => {
        seriesBtn.remove();
        workBtn.remove();
    };
}

afterEach(() => {
    cleanup(); // RTL 컴포넌트 unmount
    driveMock.mockClear();
    destroyMock.mockClear();
    capturedConfig = null;
    sessionStorage.clear();
});

describe("LibraryOnboardingTour — 축하 애니메이션 연결", () => {
    it("마지막 step 완료(onNextClick 후 onDestroyed) → OnboardingCelebration 렌더", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        const removeTargets = insertTargets();

        try {
            render(<LibraryOnboardingTour />);
            // 폴링 없이 타겟이 즉시 존재 → 동기 시작되어야 함
            await waitFor(() => expect(driveMock).toHaveBeenCalled());

            // 마지막 step 완료 버튼 클릭 → lastStepReachedRef.current = true → destroy
            const steps = capturedConfig?.steps as Array<{ popover?: { onNextClick?: () => void } }>;
            const lastStep = steps?.[steps.length - 1];
            act(() => {
                lastStep?.popover?.onNextClick?.();
            });
            // driver destroy 후 onDestroyed 발화 → setShowCelebration(true)
            act(() => {
                capturedConfig?.onDestroyed?.();
            });

            expect(screen.getByText("작업실이 준비됐어요")).toBeDefined();
        } finally {
            removeTargets();
        }
    });

    it("중도 이탈(onCloseClick 후 onDestroyed) → OnboardingCelebration 미렌더", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        const removeTargets = insertTargets();

        try {
            render(<LibraryOnboardingTour />);
            await waitFor(() => expect(driveMock).toHaveBeenCalled());

            // × 클릭 → lastStepReachedRef.current = false → destroy → onDestroyed
            act(() => {
                capturedConfig?.onCloseClick?.();
            });
            act(() => {
                capturedConfig?.onDestroyed?.();
            });

            expect(screen.queryByText("작업실이 준비됐어요")).toBeNull();
        } finally {
            removeTargets();
        }
    });

    it("중도 이탈(onDestroyed 단독, ESC) → OnboardingCelebration 미렌더", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        const removeTargets = insertTargets();

        try {
            render(<LibraryOnboardingTour />);
            await waitFor(() => expect(driveMock).toHaveBeenCalled());

            // onNextClick 없이 onDestroyed 만 발화 — ESC/배경 클릭
            act(() => {
                capturedConfig?.onDestroyed?.();
            });

            expect(screen.queryByText("작업실이 준비됐어요")).toBeNull();
        } finally {
            removeTargets();
        }
    });
});
