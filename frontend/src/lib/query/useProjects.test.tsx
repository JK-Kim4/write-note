import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { useDeleteProject } from "./useProjects";

/**
 * 작품 삭제 시 lastProject 정리 회귀 테스트 (019 버그픽스 C).
 * 삭제된 작품이 "마지막으로 연 작품"(wn:lastProjectId)이면 키를 지워
 * Rail 집필/인물이 stale id 로 진입하는 것을 막는다.
 */

const ORIGIN = "http://localhost:3000";
const KEY = "wn:lastProjectId";

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeleteProject — lastProject 정리 (버그 C)", () => {
    beforeEach(() => {
        localStorage.clear();
        server.use(http.delete(`${ORIGIN}/api/projects/:id`, () => new HttpResponse(null, { status: 204 })));
    });

    it("삭제한 작품이 lastProject 면 키를 지운다", async () => {
        localStorage.setItem(KEY, "5");
        const { result } = renderHook(() => useDeleteProject(), { wrapper });

        result.current.mutate(5);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("다른 작품을 삭제하면 lastProject 는 유지된다", async () => {
        localStorage.setItem(KEY, "7");
        const { result } = renderHook(() => useDeleteProject(), { wrapper });

        result.current.mutate(5);

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(localStorage.getItem(KEY)).toBe("7");
    });
});
