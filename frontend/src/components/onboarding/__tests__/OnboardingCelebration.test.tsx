/**
 * OnboardingCelebration 컴포넌트 행위 테스트.
 *
 * 검증 대상:
 *   - 마운트 시 축하 컨텐츠 렌더(role="status" + 헤드라인 텍스트)
 *   - 타이머 후 onDone 자동 호출(~2400ms)
 *   - ESC 키 누르면 즉시 onDone 호출
 *   - 클릭 시 즉시 onDone 호출
 *   - prefers-reduced-motion: reduce = 애니메이션 없이 헤드라인+씰만 렌더
 *   - 언마운트 시 타이머 클린업(onDone 미호출)
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingCelebration } from "../OnboardingCelebration";

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("OnboardingCelebration — 렌더", () => {
    it("마운트 시 role=status 오버레이를 렌더한다", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);
        expect(screen.getByRole("status")).toBeDefined();
    });

    it("헤드라인 텍스트 '작업실이 준비됐어요'를 렌더한다", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);
        expect(screen.getByText("작업실이 준비됐어요")).toBeDefined();
    });

    it("서브 텍스트를 렌더한다", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);
        expect(screen.getByText(/첫 작품을 시작/)).toBeDefined();
    });
});

describe("OnboardingCelebration — 자동 dismiss", () => {
    it("2400ms 후 onDone을 호출한다", async () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        expect(onDone).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(2400);
        });

        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("2399ms 시점에는 onDone 미호출", async () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        await act(async () => {
            vi.advanceTimersByTime(2399);
        });

        expect(onDone).not.toHaveBeenCalled();
    });
});

describe("OnboardingCelebration — 키 이벤트", () => {
    it("ESC 키 누르면 즉시 onDone 호출", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("ESC 외 다른 키는 onDone 미호출", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        fireEvent.keyDown(document, { key: "Enter", code: "Enter" });

        expect(onDone).not.toHaveBeenCalled();
    });
});

describe("OnboardingCelebration — 클릭 dismiss", () => {
    it("오버레이 클릭 시 즉시 onDone 호출", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        const overlay = screen.getByRole("status");
        fireEvent.click(overlay);

        expect(onDone).toHaveBeenCalledTimes(1);
    });
});

describe("OnboardingCelebration — prefers-reduced-motion", () => {
    beforeEach(() => {
        // window.matchMedia mock: reduce 반환
        vi.stubGlobal(
            "matchMedia",
            vi.fn((query: string) => ({
                matches: query === "(prefers-reduced-motion: reduce)",
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        );
    });

    it("prefers-reduced-motion: reduce 시 헤드라인과 씰을 렌더한다", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        render(<OnboardingCelebration onDone={onDone} />);

        expect(screen.getByText("작업실이 준비됐어요")).toBeDefined();
    });

    it("prefers-reduced-motion: reduce 시 ob-celebrate--animated 클래스 없음", () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        const { container } = render(<OnboardingCelebration onDone={onDone} />);

        // animated 클래스가 없어야 함
        expect(container.querySelector(".ob-celebrate--animated")).toBeNull();
    });
});

describe("OnboardingCelebration — 언마운트 클린업", () => {
    it("언마운트 시 타이머 클린업 — onDone 미호출", async () => {
        vi.useFakeTimers();
        const onDone = vi.fn();
        const { unmount } = render(<OnboardingCelebration onDone={onDone} />);

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(3000);
        });

        expect(onDone).not.toHaveBeenCalled();
    });
});
