import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { projectKeys } from "./useProjects";
import { useMoveProjectCategory } from "./useCategories";
import type { ProjectCard } from "@/lib/types/domain";

/** 작품 이동(032) 낙관적 업데이트 — 드래그 드롭 즉시 카드가 옮겨 보이고 실패 시 롤백. */
const ORIGIN = "http://localhost:3000";

function card(id: number, categoryId: number | null): ProjectCard {
    return {
        id,
        title: `작품${id}`,
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        categoryId,
        paperSize: "A4",
        layoutMode: "paper",
        fontScale: "m",
        archivedAt: null,
        createdAt: "2026-06-22T00:00:00Z",
        updatedAt: "2026-06-22T00:00:00Z",
        lastSentenceSource: "",
        wordCount: 0,
        docUpdatedAt: "2026-06-22T00:00:00Z",
        totalDurationMs: 0,
    };
}

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(projectKeys.cards(), [card(1, null), card(2, null)]);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe("useMoveProjectCategory — 낙관적 업데이트", () => {
    it("이동 성공 시 카드 캐시의 categoryId 를 갱신한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/projects/1/category`, () =>
                HttpResponse.json({ success: true, data: { id: 1, categoryId: 7 }, error: null }),
            ),
        );
        const { client, wrapper } = setup();
        const { result } = renderHook(() => useMoveProjectCategory(), { wrapper });

        result.current.mutate({ projectId: 1, categoryId: 7 });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const cards = client.getQueryData<ProjectCard[]>(projectKeys.cards());
        expect(cards?.find((c) => c.id === 1)?.categoryId).toBe(7);
        expect(cards?.find((c) => c.id === 2)?.categoryId).toBeNull();
    });

    it("이동 실패 시 이전 캐시로 롤백한다", async () => {
        server.use(http.patch(`${ORIGIN}/api/projects/1/category`, () => new HttpResponse(null, { status: 500 })));
        const { client, wrapper } = setup();
        const { result } = renderHook(() => useMoveProjectCategory(), { wrapper });

        result.current.mutate({ projectId: 1, categoryId: 7 });

        await waitFor(() => expect(result.current.isError).toBe(true));
        const cards = client.getQueryData<ProjectCard[]>(projectKeys.cards());
        expect(cards?.find((c) => c.id === 1)?.categoryId).toBeNull();
    });
});
