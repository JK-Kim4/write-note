import { render, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryOnboardingTour } from "./LibraryOnboardingTour";

/**
 * LibraryOnboardingTour 행위 테스트.
 *
 * driver.js — 시스템 경계 mock.
 * sessionStorage — jsdom 실제 사용(임시 스토어, 탭 한정).
 * DOM 타겟 — 테스트에서 직접 삽입해 "DOM 준비" 시뮬레이션.
 *
 * 검증 대상:
 *   - stage==="library" 면 2차 투어 시작 후 핸드오프 키 제거
 *   - stage 없으면 투어 시작하지 않음
 *   - 타겟 DOM 준비 될 때까지 대기 후 시작
 *   - 폴링 상한 도달 시 조용히 skip(투어 미시작, 오류 없음)
 */

// ── driver.js mock ───────────────────────────────────────────────────────────
const driveMock = vi.fn();
const destroyMock = vi.fn();

vi.mock("driver.js", () => ({
    driver: () => ({ drive: driveMock, destroy: destroyMock }),
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
    driveMock.mockClear();
    destroyMock.mockClear();
    sessionStorage.clear();
    vi.useRealTimers();
});

describe("LibraryOnboardingTour — 시작 조건", () => {
    it("stage=library 이고 타겟이 존재하면 투어를 시작하고 핸드오프 키를 제거한다", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        const cleanup = insertTargets();
        try {
            render(<LibraryOnboardingTour />);
            await waitFor(() => expect(driveMock).toHaveBeenCalled());
            expect(sessionStorage.getItem(HANDOFF_KEY)).toBeNull();
        } finally {
            cleanup();
        }
    });

    it("stage 가 없으면 투어를 시작하지 않는다", async () => {
        // sessionStorage 에 핸드오프 키 없음
        const cleanup = insertTargets();
        try {
            render(<LibraryOnboardingTour />);
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 50));
            expect(driveMock).not.toHaveBeenCalled();
        } finally {
            cleanup();
        }
    });
});

describe("LibraryOnboardingTour — 타겟 대기", () => {
    it("타겟이 지연 삽입되어도 대기 후 시작한다", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        render(<LibraryOnboardingTour />);

        // 아직 타겟 없음 → 바로 시작 안 됨
        await new Promise((r) => setTimeout(r, 10));
        expect(driveMock).not.toHaveBeenCalled();

        // 타겟 삽입
        const cleanup = insertTargets();
        try {
            await waitFor(() => expect(driveMock).toHaveBeenCalled(), { timeout: 2000 });
            expect(sessionStorage.getItem(HANDOFF_KEY)).toBeNull();
        } finally {
            cleanup();
        }
    });

    it("폴링 상한 도달 시 조용히 skip — 투어 미시작, 오류 없음", async () => {
        sessionStorage.setItem(HANDOFF_KEY, "library");
        // 타겟 삽입 안 함

        // fake timers 로 폴링 상한까지 빠르게 진행
        vi.useFakeTimers();
        render(<LibraryOnboardingTour />);

        // 상한(2000ms)보다 충분히 이상 진행
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(driveMock).not.toHaveBeenCalled();
        // 에러 없이 종료됨(테스트 자체가 통과하면 에러 없음 확인)
    });
});
