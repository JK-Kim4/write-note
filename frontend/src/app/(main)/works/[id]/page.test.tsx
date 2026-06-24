import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import BWorkDetailPage from "./page";

/**
 * B형 집필실 /works/[id] 테스트 (033 — 챕터 제거: 작품 1개 = 본문 1개).
 *
 * T1 — 복귀 링크: 에러 상태 복귀 링크가 /library 를 가리키는지 검증
 *      (route group (main) 이라 URL 에 /b 접두 없음 — 잘못된 /b/library 404 회귀 방지).
 *
 * T2 — 목차: 에디터가 onOutlineChange 로 올린 전체 문서 heading 이 패널에 표시되는지.
 *
 * T3 — 작업 종료 후 /library 라우팅.
 */

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn() }),
    usePathname: () => "/works/1",
    useParams: () => ({ id: "1" }),
}));

// BCustomChapterEditor(자체엔진 — EditContext/DOM 측정), BWorkSidePanel 은 jsdom 미지원 API 사용 → mock.
// onOutlineChange: 에디터가 전체 문서(여러 페이지에 걸친 heading 전부) 목차를 page 로 올리는 콜백.
// mock 은 마운트 시 2개(서로 다른 페이지에 있다고 가정) 제목을 올려, 목차가 페이지 한정이 아닌
// 전체 작품 기준으로 표시되는지 검증할 수 있게 한다.
vi.mock("@/components/custom-editor/BCustomChapterEditor", async () => {
    const { useEffect } = await import("react");
    return {
        BCustomChapterEditor: ({
            onOutlineChange,
        }: {
            onOutlineChange?: (items: { level: 1 | 2 | 3; text: string; index: number }[]) => void;
        }) => {
            useEffect(() => {
                onOutlineChange?.([
                    { level: 1, text: "1페이지 제목", index: 0 },
                    { level: 1, text: "2페이지 제목", index: 1 },
                ]);
            }, [onOutlineChange]);
            return <div data-testid="b-editor" />;
        },
    };
});
vi.mock("@/components/b/BWorkSidePanel", () => ({
    BWorkSidePanel: () => <div data-testid="b-work-side-panel" />,
}));

const ORIGIN = "http://localhost:3000";

const PROJECT_DOC = {
    id: 10,
    projectId: 1,
    title: "본문",
    body: '{"type":"doc","content":[]}',
    wordCount: 0,
    version: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
};

function stubCommon() {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1`, () =>
            HttpResponse.json({
                success: true,
                data: {
                    id: 1,
                    title: "테스트 작품",
                    genre: null,
                    targetLength: null,
                    toneNotes: null,
                    synopsis: null,
                    worldNotes: null,
                    nextScene: "",
                    paperSize: "A4",
                    archivedAt: null,
                    createdAt: "2026-06-01T00:00:00Z",
                    updatedAt: "2026-06-01T00:00:00Z",
                },
                error: null,
            }),
        ),
        http.get(`${ORIGIN}/api/projects/1/document`, () =>
            HttpResponse.json({ success: true, data: PROJECT_DOC, error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/10`, () =>
            HttpResponse.json({ success: true, data: PROJECT_DOC, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/memos`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/characters`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        http.post(`${ORIGIN}/api/projects/1/work-sessions/start`, () =>
            HttpResponse.json({
                success: true,
                data: { id: 1, projectId: 1, startedAt: "2026-06-01T00:00:00Z", endedAt: null },
                error: null,
            }),
        ),
        http.post(`${ORIGIN}/api/projects/1/work-sessions/end`, () =>
            HttpResponse.json({ success: true, data: null, error: null }),
        ),
    );
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BWorkDetailPage />
        </QueryClientProvider> as ReactNode,
    );
}

// 작품(집필실) 페이지는 EditContext 미지원(iOS)이면 차단 가드를 띄운다(026, 사용자 결정 2026-06-18).
// 이 테스트들은 지원 브라우저(데스크탑·안드 Chromium)를 가정하므로 EditContext 를 stub 해 스튜디오가
// 렌더되게 한다(jsdom 엔 EditContext 가 없어 기본은 iOS 와 동일하게 차단됨).
beforeEach(() => {
    vi.stubGlobal("EditContext", class {});
});

describe("BWorkDetailPage — 복귀 링크", () => {
    it("작품 로드 에러 시 '작품 목록으로' 링크가 /library 를 가리킨다", async () => {
        server.use(
            http.get(`${ORIGIN}/api/auth/me`, () =>
                HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/:id/work-sessions/start`, () =>
                HttpResponse.json({ success: true, data: { sessionId: 1 }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/:id/work-sessions/end`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/:id/memos`, () =>
                HttpResponse.json({ success: true, data: [], error: null }),
            ),
            http.get(`${ORIGIN}/api/projects/1`, () =>
                HttpResponse.json(
                    { success: false, error: { code: "NOT_FOUND", message: "없음" } },
                    { status: 404 },
                ),
            ),
            http.get(`${ORIGIN}/api/projects/1/document`, () =>
                HttpResponse.json(
                    { success: false, error: { code: "NOT_FOUND", message: "없음" } },
                    { status: 404 },
                ),
            ),
        );

        renderPage();

        const link = await screen.findByRole("link", { name: "작품 목록으로" });
        expect(link).toHaveAttribute("href", "/library");
    });
});

describe("BWorkDetailPage — 목차는 전체 작품 기준 (페이지 한정 회귀 방지)", () => {
    /**
     * 회귀: 기존 useCustomOutline(DOM 스캔)은 현재 보이는 페이지 1장의 heading 만 긁어,
     * 페이지를 넘기면 목차가 초기화됐다. 에디터가 onOutlineChange 로 올리는 전체 문서 목차를
     * page 가 그대로 패널에 표시해야 한다 — 서로 다른 페이지의 제목이 동시에 보이는지로 검증.
     */
    it("에디터가 올린 전체 문서 heading 이 모두 목차 패널에 표시된다", async () => {
        stubCommon();
        renderPage();

        // inline/drawer 양쪽 렌더라 getAllBy 로 최소 1개 이상 존재 확인.
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: "1페이지 제목" }).length).toBeGreaterThan(0);
        });
        expect(screen.getAllByRole("button", { name: "2페이지 제목" }).length).toBeGreaterThan(0);
    });
});

describe("BWorkDetailPage — 집필 종료 후 라우팅 (404 회귀 방지)", () => {
    it("타임워치 집필 종료 후 /library 로 이동한다 (잘못된 /b/library 404 회귀 방지)", async () => {
        pushMock.mockClear();
        stubCommon();
        server.use(
            http.post(`${ORIGIN}/api/projects/1/work-sessions/start`, () =>
                HttpResponse.json({ success: true, data: { id: 1, projectId: 1, startedAt: new Date().toISOString(), endedAt: null }, error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/1/work-sessions/end`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
        );
        renderPage();

        // 타임워치 시작 → 집필 종료 → 메모 없이 종료
        const startBtns = await screen.findAllByRole("button", { name: /시작/ });
        await userEvent.click(startBtns[0]);
        const stopBtns = await screen.findAllByRole("button", { name: /집필 종료/ });
        await userEvent.click(stopBtns[0]);
        await userEvent.click(await screen.findByRole("button", { name: "메모 없이 종료" }));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/library"));
    });
});
