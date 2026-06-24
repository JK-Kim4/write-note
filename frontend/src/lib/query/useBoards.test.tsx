import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { boardKeys, useRenameBoard } from "./useBoards";
import type { BoardSummary } from "@/lib/api/boards";

/** 플롯 보드(038) 이름 변경 낙관적 업데이트 — 즉시 반영, 실패 시 롤백(FR-014). */
const ORIGIN = "http://localhost:3000";

function summary(id: number, name: string): BoardSummary {
    return { id, name, projectId: null, categoryId: null, nodeCount: 0, updatedAt: "2026-06-24T00:00:00Z" };
}

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(boardKeys.list(), [summary(1, "보드1"), summary(2, "보드2")]);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe("useRenameBoard — 낙관적 업데이트", () => {
    it("이름 변경 성공 시 목록 캐시의 name 을 갱신한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/boards/1`, () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        id: 1,
                        name: "새 이름",
                        projectId: null,
                        categoryId: null,
                        viewport: { zoom: 1, x: 0, y: 0 },
                        createdAt: "2026-06-24T00:00:00Z",
                        updatedAt: "2026-06-24T00:00:00Z",
                    },
                    error: null,
                }),
            ),
        );
        const { client, wrapper } = setup();
        const { result } = renderHook(() => useRenameBoard(), { wrapper });

        result.current.mutate({ id: 1, name: "새 이름" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const list = client.getQueryData<BoardSummary[]>(boardKeys.list());
        expect(list?.find((b) => b.id === 1)?.name).toBe("새 이름");
        expect(list?.find((b) => b.id === 2)?.name).toBe("보드2");
    });

    it("이름 변경 실패 시 이전 캐시로 롤백한다", async () => {
        server.use(http.patch(`${ORIGIN}/api/boards/1`, () => new HttpResponse(null, { status: 500 })));
        const { client, wrapper } = setup();
        const { result } = renderHook(() => useRenameBoard(), { wrapper });

        result.current.mutate({ id: 1, name: "새 이름" });

        await waitFor(() => expect(result.current.isError).toBe(true));
        const list = client.getQueryData<BoardSummary[]>(boardKeys.list());
        expect(list?.find((b) => b.id === 1)?.name).toBe("보드1");
    });
});
