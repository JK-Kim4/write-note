import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimewatch } from "./useTimewatch";

const sessions = vi.hoisted(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    endBeacon: vi.fn(),
    endWithLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/electron-api", () => ({ webElectronApi: { sessions } }));

function wrapper({ children }: { children: ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
    sessions.start.mockClear();
    sessions.end.mockClear();
    sessions.endWithLog.mockClear();
    sessions.endBeacon.mockClear();
});

describe("useTimewatch", () => {
    it("시작하면 running + sessions.start 호출", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        expect(result.current.status).toBe("running");
        expect(sessions.start).toHaveBeenCalledWith(1);
    });

    it("일시정지하면 paused + sessions.end 호출", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        act(() => result.current.pause());
        expect(result.current.status).toBe("paused");
        expect(sessions.end).toHaveBeenCalledWith(1);
    });

    it("다시 시작하면 running + sessions.start 재호출(새 구간)", () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        act(() => result.current.pause());
        act(() => result.current.resume());
        expect(result.current.status).toBe("running");
        expect(sessions.start).toHaveBeenCalledTimes(2);
    });

    it("메모와 함께 종료하면 endWithLog 호출 + idle", async () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        await act(async () => { await result.current.stop("3장 다시 씀"); });
        expect(sessions.endWithLog).toHaveBeenCalledWith(1, "3장 다시 씀");
        expect(result.current.status).toBe("idle");
    });

    it("메모 없이 종료(running)면 end 호출 + idle", async () => {
        const { result } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        await act(async () => { await result.current.stop(); });
        expect(sessions.end).toHaveBeenCalledWith(1);
        expect(sessions.endWithLog).not.toHaveBeenCalled();
        expect(result.current.status).toBe("idle");
    });

    it("running 중 언마운트하면 end 로 자동 기록", () => {
        const { result, unmount } = renderHook(() => useTimewatch(1), { wrapper });
        act(() => result.current.start());
        sessions.end.mockClear();
        unmount();
        expect(sessions.end).toHaveBeenCalledWith(1);
    });

    it("idle 에서 언마운트하면 end 호출 없음", () => {
        const { unmount } = renderHook(() => useTimewatch(1), { wrapper });
        unmount();
        expect(sessions.end).not.toHaveBeenCalled();
    });
});
