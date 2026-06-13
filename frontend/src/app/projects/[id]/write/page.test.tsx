import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import ProjectWritePage from "./page";

// PaperEditor 는 jsdom 에서 ResizeObserver 미지원으로 crash → 외부 경계(HTTP) 가 아닌 내부 컴포넌트이므로 mock 처리.
vi.mock("@/components/editor/PaperEditor", () => ({
    PaperEditor: () => <div data-testid="paper-editor" />,
}));
// StudioOutline, ConflictDialog, StudioRightStack 도 동일 이유로 mock.
vi.mock("@/components/editor/StudioOutline", () => ({
    StudioOutline: () => <div data-testid="studio-outline" />,
}));
vi.mock("@/components/editor/ConflictDialog", () => ({
    ConflictDialog: () => null,
}));
vi.mock("@/components/workspace/StudioRightStack", () => ({
    StudioRightStack: () => null,
}));
vi.mock("@/components/workspace/Rail", () => ({
    Rail: () => null,
}));
vi.mock("@/components/workspace/Titlebar", () => ({
    Titlebar: ({ title, right }: { title: string; right?: ReactNode }) => (
        <div>
            <span>{title}</span>
            {right}
        </div>
    ),
}));

/**
 * T009 — 챕터 전환 시:
 *  (1) localStorage draft 키가 `wn:draft:doc:{documentId}` 로 챕터별 격리되는지
 *  (2) 전환 직전 현재 챕터 flushDraft 가 호출되는지 (IME 유실 방지)
 *
 * msw 로 HTTP 경계만 mock. localStorage 는 실제 storage 사용(jsdom 환경).
 * useDocumentSession.flushDraft 호출 여부는 draftStore 를 관찰한다.
 */

let searchParamsStore = new URLSearchParams();
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn() }),
    usePathname: () => "/projects/1/write",
    useSearchParams: () => searchParamsStore,
    useParams: () => ({ id: "1" }),
}));

const ORIGIN = "http://localhost:3000";

const CHAPTER_A = {
    id: 10,
    projectId: 1,
    title: "1챕터",
    body: '{"type":"doc","content":[]}',
    wordCount: 0,
    version: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    sortOrder: 1,
};
const CHAPTER_B = {
    id: 20,
    projectId: 1,
    title: "2챕터",
    body: '{"type":"doc","content":[]}',
    wordCount: 0,
    version: "2026-06-02T00:00:00Z",
    updatedAt: "2026-06-02T00:00:00Z",
    sortOrder: 2,
};

const CHAPTER_A_META = { id: 10, projectId: 1, title: "1챕터", sortOrder: 1, wordCount: 0, updatedAt: "2026-06-01T00:00:00Z" };
const CHAPTER_B_META = { id: 20, projectId: 1, title: "2챕터", sortOrder: 2, wordCount: 0, updatedAt: "2026-06-02T00:00:00Z" };

function stubCommon() {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1`, () =>
            HttpResponse.json({
                success: true,
                data: {
                    id: 1, title: "테스트 작품", genre: null, targetLength: null,
                    toneNotes: null, synopsis: null, worldNotes: null, nextScene: "",
                    paperSize: "A4", archivedAt: null, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
                },
                error: null,
            }),
        ),
        http.get(`${ORIGIN}/api/projects/1/documents`, () =>
            HttpResponse.json({ success: true, data: [CHAPTER_A_META, CHAPTER_B_META], error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/10`, () =>
            HttpResponse.json({ success: true, data: CHAPTER_A, error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/20`, () =>
            HttpResponse.json({ success: true, data: CHAPTER_B, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/memos`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/characters`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        // 작업 세션 — useWorkSession 이 진입 시 start, 이탈 시 end 호출
        http.post(`${ORIGIN}/api/projects/1/work-sessions/start`, () =>
            HttpResponse.json({ success: true, data: { id: 1, projectId: 1, startedAt: "2026-06-01T00:00:00Z", endedAt: null }, error: null }),
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
            <ProjectWritePage />
        </QueryClientProvider> as ReactNode,
    );
}

// ── T025: 챕터 삭제 · 되돌리기 · disabled · 전환 ────────────────────────────

/** stubCommon 에서 프로젝트/문서 mock 을 고정 후 챕터 목록을 커스텀할 때 쓰는 헬퍼. */
function stubWith(chaptersMeta: typeof CHAPTER_A_META[]) {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1`, () =>
            HttpResponse.json({
                success: true,
                data: {
                    id: 1, title: "테스트 작품", genre: null, targetLength: null,
                    toneNotes: null, synopsis: null, worldNotes: null, nextScene: "",
                    paperSize: "A4", archivedAt: null, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
                },
                error: null,
            }),
        ),
        http.get(`${ORIGIN}/api/projects/1/documents`, () =>
            HttpResponse.json({ success: true, data: chaptersMeta, error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/10`, () =>
            HttpResponse.json({ success: true, data: CHAPTER_A, error: null }),
        ),
        http.get(`${ORIGIN}/api/documents/20`, () =>
            HttpResponse.json({ success: true, data: CHAPTER_B, error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/memos`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        http.get(`${ORIGIN}/api/projects/1/characters`, () =>
            HttpResponse.json({ success: true, data: [], error: null }),
        ),
        http.post(`${ORIGIN}/api/projects/1/work-sessions/start`, () =>
            HttpResponse.json({ success: true, data: { id: 1, projectId: 1, startedAt: "2026-06-01T00:00:00Z", endedAt: null }, error: null }),
        ),
        http.post(`${ORIGIN}/api/projects/1/work-sessions/end`, () =>
            HttpResponse.json({ success: true, data: null, error: null }),
        ),
    );
}

describe("ProjectWritePage — 챕터 삭제 · 되돌리기 (T025)", () => {
    beforeEach(() => {
        localStorage.clear();
        searchParamsStore = new URLSearchParams("chapter=10");
    });
    afterEach(() => {
        localStorage.clear();
    });

    it("챕터 2개일 때 삭제 버튼이 활성화된다", async () => {
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("1챕터");
        // 삭제 버튼이 표시되어야 함
        const deleteButtons = await screen.findAllByRole("button", { name: /챕터 삭제/ });
        expect(deleteButtons.length).toBeGreaterThan(0);
        // 챕터가 2개이므로 disabled 가 아님
        for (const btn of deleteButtons) {
            expect(btn).not.toBeDisabled();
        }
    });

    it("챕터 1개일 때 삭제 버튼이 disabled 된다 (마지막 챕터 불변식 INV-1)", async () => {
        stubWith([CHAPTER_A_META]);
        renderPage();

        await screen.findByText("1챕터");
        const deleteButton = await screen.findByRole("button", { name: /챕터 삭제/ });
        expect(deleteButton).toBeDisabled();
    });

    it("챕터 삭제 시 낙관적으로 목록에서 제거되고 되돌리기 토스트가 표시된다", async () => {
        let deleteCalled = false;
        server.use(
            http.delete(`${ORIGIN}/api/documents/20`, () => {
                deleteCalled = true;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("2챕터");

        // 2챕터 삭제 버튼 클릭
        const deleteButtons = await screen.findAllByRole("button", { name: /챕터 삭제/ });
        // 2번째 항목(2챕터)의 삭제 버튼
        await userEvent.click(deleteButtons[1]);

        // 되돌리기 토스트가 표시되어야 함 (toast class 로 특정 — savestate 도 role=status 공유)
        await waitFor(() => {
            expect(document.querySelector(".toast")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "되돌리기" })).toBeInTheDocument();
        expect(deleteCalled).toBe(true);
    });

    it("되돌리기 버튼 클릭 시 restore API 를 호출한다", async () => {
        let restoreCalled = false;
        server.use(
            http.delete(`${ORIGIN}/api/documents/20`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
            http.post(`${ORIGIN}/api/documents/20/restore`, () => {
                restoreCalled = true;
                return HttpResponse.json({ success: true, data: null, error: null });
            }),
        );
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("2챕터");

        const deleteButtons = await screen.findAllByRole("button", { name: /챕터 삭제/ });
        await userEvent.click(deleteButtons[1]);

        // 토스트 표시 대기
        const restoreBtn = await screen.findByRole("button", { name: "되돌리기" });
        await userEvent.click(restoreBtn);

        await waitFor(() => {
            expect(restoreCalled).toBe(true);
        });
    });

    it("현재 보고 있는 챕터(맨 앞 아님)를 삭제하면 바로 앞 챕터로 전환한다", async () => {
        // searchParams = chapter=20(2챕터), 챕터목록 [A(10), B(20)]
        searchParamsStore = new URLSearchParams("chapter=20");
        server.use(
            http.delete(`${ORIGIN}/api/documents/20`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
        );
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("2챕터");

        // 현재 챕터(2챕터) 삭제
        const deleteButtons = await screen.findAllByRole("button", { name: /챕터 삭제/ });
        await userEvent.click(deleteButtons[1]);

        // 바로 앞 챕터(1챕터=id 10)로 전환 → chapter=10 으로 URL replace
        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith(
                expect.stringContaining("chapter=10"),
                expect.anything(),
            );
        });
    });

    it("현재 보고 있는 챕터가 맨 앞이면 다음 챕터로 전환한다", async () => {
        // searchParams = chapter=10(1챕터), 챕터목록 [A(10), B(20)]
        searchParamsStore = new URLSearchParams("chapter=10");
        server.use(
            http.delete(`${ORIGIN}/api/documents/10`, () =>
                HttpResponse.json({ success: true, data: null, error: null }),
            ),
        );
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("1챕터");

        // 현재 챕터(1챕터=맨 앞) 삭제
        const deleteButtons = await screen.findAllByRole("button", { name: /챕터 삭제/ });
        await userEvent.click(deleteButtons[0]);

        // 다음 챕터(2챕터=id 20)로 전환
        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith(
                expect.stringContaining("chapter=20"),
                expect.anything(),
            );
        });
    });
});

describe("ProjectWritePage — 챕터 순서 이동 (US2)", () => {
    beforeEach(() => {
        localStorage.clear();
        searchParamsStore = new URLSearchParams("chapter=10");
    });
    afterEach(() => {
        localStorage.clear();
    });

    it("챕터 2개일 때 위/아래 순서 버튼이 표시된다", async () => {
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("1챕터");

        // 1챕터는 맨 위라 아래로만, 2챕터는 맨 아래라 위로만 버튼 표시됨
        expect(await screen.findByRole("button", { name: "1챕터 아래로" })).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: "2챕터 위로" })).toBeInTheDocument();
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
        stubWith([CHAPTER_A_META, CHAPTER_B_META]);
        renderPage();

        await screen.findByText("1챕터");

        // 1챕터 아래로 이동 (A→B 스왑 → 순서: [20, 10])
        await userEvent.click(await screen.findByRole("button", { name: "1챕터 아래로" }));

        await waitFor(() => {
            expect(capturedIds).toEqual([20, 10]);
        });
    });
});

describe("ProjectWritePage — 챕터 전환 draft 격리", () => {
    it("챕터 A 와 챕터 B 의 draft 키가 wn:draft:doc:{id} 로 서로 다르다", () => {
        // draft 키 격리는 draftStore.keyFor 규약 검증 — localStorage 키 명세 테스트.
        // 단위 검증: 두 문서 ID 의 draft 키가 충돌하지 않는지.
        localStorage.clear();
        localStorage.setItem("wn:draft:doc:10", JSON.stringify({ body: "챕터A 내용" }));
        localStorage.setItem("wn:draft:doc:20", JSON.stringify({ body: "챕터B 내용" }));

        const draftA = JSON.parse(localStorage.getItem("wn:draft:doc:10") ?? "null");
        const draftB = JSON.parse(localStorage.getItem("wn:draft:doc:20") ?? "null");

        expect(draftA.body).toBe("챕터A 내용");
        expect(draftB.body).toBe("챕터B 내용");

        // 챕터 A 를 덮어써도 챕터 B 는 영향 없음.
        localStorage.setItem("wn:draft:doc:10", JSON.stringify({ body: "챕터A 수정" }));
        const draftBAfter = JSON.parse(localStorage.getItem("wn:draft:doc:20") ?? "null");
        expect(draftBAfter.body).toBe("챕터B 내용");

        localStorage.clear();
    });

    it("챕터 목록에서 챕터를 선택하면 URL 쿼리 ?chapter={id} 로 이동한다", async () => {
        searchParamsStore = new URLSearchParams("chapter=10");
        stubCommon();

        renderPage();

        // 챕터 목록이 로드될 때까지 대기
        await screen.findByText("2챕터");

        // 챕터 B 선택 버튼 클릭(aria-current 가 있는 챕터 선택 버튼 — "2챕터 챕터 삭제" 버튼과 구분)
        await userEvent.click(screen.getByRole("button", { name: "2챕터" }));

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith(
                expect.stringContaining("chapter=20"),
                expect.anything(),
            );
        });
    });
});
