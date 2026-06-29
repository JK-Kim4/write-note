import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import EnteringPage from "./page";

const replace = vi.fn();
const invalidateQueries = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
}));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ invalidateQueries }),
}));

describe("EnteringPage — 로그인 중 트랜지션", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        replace.mockClear();
        invalidateQueries.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("0.5초 효과 구간(마운트 직후)에는 아직 홈으로 보내지 않는다", () => {
        render(<EnteringPage />);
        vi.advanceTimersByTime(400);
        expect(replace).not.toHaveBeenCalled();
    });

    it("효과(0.5초) + 페이드 마감 경과 후 앱 홈(/)으로 replace 한다", () => {
        render(<EnteringPage />);
        vi.advanceTimersByTime(900);
        expect(replace).toHaveBeenCalledWith("/");
    });

    it("마운트 시 auth/me 캐시를 무효화한다(로그인 직후 홈 requireAuth 가 200 을 보게)", () => {
        render(<EnteringPage />);
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["auth", "me"] });
    });
});
