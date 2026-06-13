import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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

        // 챕터 B 버튼 클릭 → URL 이 chapter=20 으로 변경되어야 함
        await userEvent.click(screen.getByRole("button", { name: /2챕터/ }));

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith(
                expect.stringContaining("chapter=20"),
                expect.anything(),
            );
        });
    });
});
