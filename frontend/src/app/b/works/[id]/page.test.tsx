import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import BWorkDetailPage from "./page";

/**
 * B형 집필실 /b/works/[id] 테스트.
 *
 * T1 — 복귀 링크: 에러 상태 복귀 링크가 /b/library 를 가리키는지 검증
 *      (라우트 이동 refactor: 작품 벽 /b → /b/library 회귀 방지).
 *
 * T2 — 챕터 목록 표시: GET /api/projects/:id/documents 로 챕터 목록이 로드되어 화면에 나타나는지.
 *
 * T3 — 챕터 전환: 다른 챕터 버튼 클릭 시 URL 이 ?chapter={id} 로 변경되고
 *      drawer 가 닫히는 사이드이펙트(setLeftDrawerOpen(false))가 함께 발생하는지.
 */

const pushMock = vi.fn();
const replaceMock = vi.fn();

let searchParamsStore = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn() }),
    usePathname: () => "/b/works/1",
    useSearchParams: () => searchParamsStore,
    useParams: () => ({ id: "1" }),
}));

// BEditor, BWorkSidePanel 은 jsdom 미지원 API(ResizeObserver 등) 사용 → 내부 컴포넌트이므로 mock.
// chapterTitle / onChapterRename 을 노출해 본문 상단 제목 편집 흐름 검증 가능.
vi.mock("@/components/b/BEditor", () => ({
    BEditor: ({
        chapterTitle,
        onChapterRename,
    }: {
        chapterTitle?: string;
        onChapterRename?: (title: string) => void;
    }) => (
        <div data-testid="b-editor">
            {chapterTitle != null && (
                <span
                    data-testid="b-editor-chapter-title"
                    onDoubleClick={() => onChapterRename?.("B형 본문에서 변경된 제목")}
                >
                    {chapterTitle || "새 챕터"}
                </span>
            )}
        </div>
    ),
}));
vi.mock("@/components/b/BWorkSidePanel", () => ({
    BWorkSidePanel: () => <div data-testid="b-work-side-panel" />,
}));
vi.mock("@/components/editor/useEditorOutline", () => ({
    useEditorOutline: () => ({ items: [], activeIndex: -1, selectItem: vi.fn() }),
}));

const ORIGIN = "http://localhost:3000";

const CHAPTER_A_META = {
    id: 10,
    projectId: 1,
    title: "1챕터",
    sortOrder: 1,
    wordCount: 0,
    updatedAt: "2026-06-01T00:00:00Z",
};
const CHAPTER_B_META = {
    id: 20,
    projectId: 1,
    title: "2챕터",
    sortOrder: 2,
    wordCount: 0,
    updatedAt: "2026-06-02T00:00:00Z",
};

const CHAPTER_A_DOC = {
    id: 10,
    projectId: 1,
    title: "1챕터",
    body: '{"type":"doc","content":[]}',
    wordCount: 0,
    version: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    sortOrder: 1,
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
        http.get(`${ORIGIN}/api/projects/1/documents`, () =>
            HttpResponse.json({ success: true, data: [CHAPTER_A_META, CHAPTER_B_META], error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/10`, () =>
            HttpResponse.json({ success: true, data: CHAPTER_A_DOC, error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/20`, () =>
            HttpResponse.json({ success: true, data: { ...CHAPTER_A_DOC, id: 20, title: "2챕터", sortOrder: 2 }, error: null }),
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

describe("BWorkDetailPage — 복귀 링크", () => {
    it("문서 로드 에러 시 '작품 목록으로' 링크가 /b/library 를 가리킨다", async () => {
        searchParamsStore = new URLSearchParams();
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
            http.get(`${ORIGIN}/api/projects/1/documents`, () =>
                HttpResponse.json({ success: true, data: [], error: null }),
            ),
        );

        renderPage();

        const link = await screen.findByRole("link", { name: "작품 목록으로" });
        expect(link).toHaveAttribute("href", "/b/library");
    });
});

describe("BWorkDetailPage — 챕터 순서 이동 (US2)", () => {
    beforeEach(() => {
        searchParamsStore = new URLSearchParams("chapter=10");
    });

    it("챕터 2개일 때 위/아래 순서 버튼이 표시된다", async () => {
        stubCommon();
        renderPage();

        // B형은 outlinePanel 을 inline + drawer 양쪽에서 공유 → 버튼이 두 벌 렌더됨
        // getAllByRole 로 최소 1개 이상 존재 확인
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: "1챕터 아래로" }).length).toBeGreaterThan(0);
        });
        expect(screen.getAllByRole("button", { name: "2챕터 위로" }).length).toBeGreaterThan(0);
    });

    it("아래로 버튼 클릭 시 PUT .../documents/order 를 호출한다", async () => {
        let capturedIds: number[] | undefined;
        server.use(
            http.put(`${ORIGIN}/api/projects/1/documents/order`, async ({ request }) => {
                const body = await request.json() as { documentIds: number[] };
                capturedIds = body.documentIds;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );
        stubCommon();
        renderPage();

        // 1챕터 아래로 버튼이 렌더될 때까지 대기 (inline panel 첫 번째 인스턴스)
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: "1챕터 아래로" }).length).toBeGreaterThan(0);
        });

        // 첫 번째 인스턴스(inline panel)의 아래로 버튼 클릭 → 순서: [20, 10]
        await userEvent.click(screen.getAllByRole("button", { name: "1챕터 아래로" })[0]);

        await waitFor(() => {
            expect(capturedIds).toEqual([20, 10]);
        });
    });
});

describe("BWorkDetailPage — 본문 상단 챕터 제목 인라인 편집 (T-BODY-RENAME)", () => {
    /**
     * BEditor mock 에 chapterTitle / onChapterRename 을 노출하므로,
     * 본문 상단 제목 영역의 더블클릭 → onChapterRename 콜백 → PATCH 호출 흐름을 검증.
     * 좌측 ChapterList rename 과 동일한 mutation(useUpdateChapterTitle)을 사용.
     */
    beforeEach(() => {
        searchParamsStore = new URLSearchParams("chapter=10");
    });

    it("본문 상단 챕터 제목이 표시된다", async () => {
        stubCommon();
        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId("b-editor-chapter-title")).toBeInTheDocument();
        });
        expect(screen.getByTestId("b-editor-chapter-title")).toHaveTextContent("1챕터");
    });

    it("본문 상단 챕터 제목 더블클릭 시 onChapterRename 이 호출되고 PATCH /api/documents/{id}/title 를 호출한다", async () => {
        let patchedId: number | undefined;
        let patchedTitle: string | undefined;

        server.use(
            http.patch(`${ORIGIN}/api/documents/:id/title`, async ({ params, request }) => {
                patchedId = Number(params["id"]);
                const body = await request.json() as { title: string };
                patchedTitle = body.title;
                return HttpResponse.json({
                    success: true,
                    data: { id: patchedId, title: patchedTitle, updatedAt: "2026-06-14T00:00:00Z" },
                    error: null,
                });
            }),
        );
        stubCommon();
        renderPage();

        // 본문 상단 챕터 제목 영역 더블클릭 → mock 이 onChapterRename("B형 본문에서 변경된 제목") 호출
        const titleEl = await screen.findByTestId("b-editor-chapter-title");
        await userEvent.dblClick(titleEl);

        // onChapterRename → handleRenameChapter(currentChapterId=10, "B형 본문에서 변경된 제목") →
        // updateChapterTitle.mutate → PATCH /api/documents/10/title
        await waitFor(() => {
            expect(patchedId).toBe(10);
            expect(patchedTitle).toBe("B형 본문에서 변경된 제목");
        });
    });
});

describe("BWorkDetailPage — 챕터 목록 및 전환", () => {
    it("챕터 목록이 로드되면 챕터 이름이 화면에 나타난다", async () => {
        searchParamsStore = new URLSearchParams("chapter=10");
        stubCommon();

        renderPage();

        // B형은 outlinePanel 을 inline panel 과 좁은 폭 drawer 양쪽에서 공유하므로
        // 챕터 버튼이 두 개씩 렌더된다 — getAllByRole 로 확인.
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: /1챕터/ }).length).toBeGreaterThan(0);
        });
        expect(screen.getAllByRole("button", { name: /2챕터/ }).length).toBeGreaterThan(0);
    });

    it("다른 챕터 버튼 클릭 시 URL 이 ?chapter={id} 로 교체된다", async () => {
        searchParamsStore = new URLSearchParams("chapter=10");
        replaceMock.mockClear();
        stubCommon();

        renderPage();

        // 챕터 목록 로드 대기 — 2챕터 버튼이 나타날 때까지
        await waitFor(() => {
            expect(screen.getAllByRole("button", { name: /2챕터/ }).length).toBeGreaterThan(0);
        });

        // 첫 번째 2챕터 버튼(inline panel) 클릭 → URL chapter=20 으로 변경
        await userEvent.click(screen.getAllByRole("button", { name: /2챕터/ })[0]);

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith(
                expect.stringContaining("chapter=20"),
                expect.anything(),
            );
        });
    });
});
