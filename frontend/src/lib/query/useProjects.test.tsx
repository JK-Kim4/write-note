import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import type { ProjectResponse } from "@/types/api";
import { useArchiveProject, useArchivedProjects, useDeleteProject, useUnarchiveProject } from "./useProjects";

/**
 * 작품 삭제 시 lastProject 정리 회귀 테스트 (019 버그픽스 C).
 * 삭제된 작품이 "마지막으로 연 작품"(wn:lastProjectId)이면 키를 지워
 * Rail 집필/인물이 stale id 로 진입하는 것을 막는다.
 */

const ORIGIN = "http://localhost:3000";
const KEY = "wn:lastProjectId";

function makeProject(overrides: Partial<ProjectResponse> = {}): ProjectResponse {
    return {
        id: 1,
        title: "테스트 작품",
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        paperSize: "A4",
        layoutMode: "paper",
        fontScale: "m",
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...overrides,
    };
}

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

describe("useArchiveProject — 보관 요청", () => {
    beforeEach(() => {
        server.use(
            http.post(`${ORIGIN}/api/projects/:id/archive`, ({ params }) => {
                const id = Number(params.id);
                return HttpResponse.json({ success: true, data: makeProject({ id, archivedAt: "2026-06-19T00:00:00Z" }), error: null });
            }),
        );
    });

    it("mutate 호출 시 isSuccess 가 된다", async () => {
        const { result } = renderHook(() => useArchiveProject(), { wrapper });
        result.current.mutate(1);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe("useUnarchiveProject — 보관 해제 요청", () => {
    beforeEach(() => {
        server.use(
            http.post(`${ORIGIN}/api/projects/:id/unarchive`, ({ params }) => {
                const id = Number(params.id);
                return HttpResponse.json({ success: true, data: makeProject({ id, archivedAt: null }), error: null });
            }),
        );
    });

    it("mutate 호출 시 isSuccess 가 된다", async () => {
        const { result } = renderHook(() => useUnarchiveProject(), { wrapper });
        result.current.mutate(1);
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});

describe("useArchivedProjects — 보관 목록 조회", () => {
    const archived = makeProject({ id: 2, title: "보관된 작품", archivedAt: "2026-06-01T00:00:00Z" });
    const active = makeProject({ id: 3, title: "활성 작품", archivedAt: null });

    beforeEach(() => {
        server.use(
            http.get(`${ORIGIN}/api/projects`, () =>
                HttpResponse.json({
                    success: true,
                    data: { content: [archived, active], totalElements: 2, totalPages: 1, number: 0, size: 200 },
                    error: null,
                }),
            ),
        );
    });

    it("enabled=true 면 archivedAt!=null 인 작품만 반환한다", async () => {
        const { result } = renderHook(() => useArchivedProjects(true), { wrapper });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data?.[0].id).toBe(2);
    });

    it("enabled=false 면 조회하지 않는다", () => {
        const { result } = renderHook(() => useArchivedProjects(false), { wrapper });
        expect(result.current.fetchStatus).toBe("idle");
        expect(result.current.data).toBeUndefined();
    });
});
