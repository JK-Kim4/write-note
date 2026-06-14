import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { weekDayRanges } from "@/lib/dashboardView";
import { usePreferences } from "@/stores/preferences";
import DashboardPage from "./page";

/**
 * 대시보드 / (018 US1) 행위 — 인사·이어서 쓰기 타일·진입 라우팅·Rail 재편·빈 상태·로딩·에러.
 * 시스템 경계(HTTP)만 msw mock.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

// 디자인 가드(B 사용자/미수화 시 A 홈 미렌더) 회피 — A 홈 행위 테스트는 수화 완료 + 기본(A) 디자인 전제.
vi.mock("@/stores/preferences", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/stores/preferences")>();
    return { ...actual, useIsPreferencesHydrated: () => true };
});

beforeEach(() => {
    usePreferences.setState({ design: "default" });
});

const ORIGIN = "http://localhost:3000";

const bodyWith = (text: string) =>
    JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

function cardJson(id: number, title: string, documentUpdatedAt: string, over: Record<string, unknown> = {}) {
    return {
        id,
        title,
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        archivedAt: null,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        wordCount: 100,
        documentUpdatedAt,
        totalDurationMs: 0,
        lastSentenceSource: "",
        ...over,
    };
}

function stubAuthed() {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
    );
}

function stubWeekly(msByDayIndex: Record<number, number> = {}) {
    const ranges = weekDayRanges(new Date());
    server.use(
        http.get(`${ORIGIN}/api/work-sessions/total`, ({ request }) => {
            const from = new URL(request.url).searchParams.get("from") ?? "";
            const idx = ranges.findIndex((r) => r.from.toISOString() === from);
            return HttpResponse.json({ success: true, data: { totalDurationMs: msByDayIndex[idx] ?? 0 }, error: null });
        }),
    );
}


function memoJson(id: number, body: string, capturedAt: string) {
    return { id, body, source: "web", capturedAt, projects: [], tags: [], reasonNote: null };
}

function stubMemos(memos: unknown[]) {
    server.use(
        http.get(`${ORIGIN}/api/memos`, () =>
            HttpResponse.json({
                success: true,
                data: { content: memos, page: 0, size: 100, totalElements: memos.length, totalPages: 1 },
                error: null,
            }),
        ),
    );
}

function stubDocument(id: number, text: string) {
    server.use(
        http.get(`${ORIGIN}/api/projects/${id}/document`, () =>
            HttpResponse.json({
                success: true,
                data: {
                    id: id * 10,
                    projectId: id,
                    title: "",
                    body: text === "" ? "{}" : bodyWith(text),
                    wordCount: 100,
                    version: 0,
                    updatedAt: "2026-06-10T02:00:00Z",
                },
                error: null,
            }),
        ),
    );
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DashboardPage />
        </QueryClientProvider> as ReactNode,
    );
}

describe("DashboardPage(/ 재진입 허브)", () => {
    it("인사(이름 없음)와 오늘 날짜를 표시한다", async () => {
        stubAuthed();
        stubWeekly();
        server.use(http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })));

        renderPage();

        expect(await screen.findByText("안녕하세요.")).toBeInTheDocument();
        const expected = new Intl.DateTimeFormat("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
        }).format(new Date());
        expect(await screen.findByText(new RegExp(expected))).toBeInTheDocument();
    });

    it("문서 저장 시각이 최신인 작품을 이어서 쓰기 타일로 보여주고, 클릭하면 집필실로 이동한다", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({
                    success: true,
                    data: [
                        cardJson(1, "옛 작품", "2026-06-01T00:00:00Z", { lastSentenceSource: "옛 마지막 문장." }),
                        cardJson(2, "최신 작품", "2026-06-10T02:00:00Z", {
                            nextScene: "등대 장면",
                            lastSentenceSource: "바다는 조용했다. 최신 마지막 문장이다.",
                        }),
                    ],
                    error: null,
                }),
            ),
        );

        renderPage();

        expect(await screen.findByText("최신 작품")).toBeInTheDocument();
        expect(screen.getByText(/최신 마지막 문장이다\./)).toBeInTheDocument();
        expect(screen.getByText(/등대 장면/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
        expect(pushMock).toHaveBeenCalledWith("/projects/2/write");
    });

    it("Rail 에 '홈' 항목이 있고 '작품'은 /library 로 보낸다(FR-008·016)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })));

        renderPage();

        expect(await screen.findByRole("button", { name: "홈" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "작품" }));
        expect(pushMock).toHaveBeenCalledWith("/library");
    });

    it("작품이 0편이면 환영 블록과 '첫 작품 시작하기' CTA(→ /library?new=1)를 보여준다", async () => {
        stubAuthed();
        stubWeekly();
        server.use(http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })));

        renderPage();

        expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "첫 작품 시작하기" }));
        expect(pushMock).toHaveBeenCalledWith("/library?new=1");
    });

    it("카드 조회 실패 시 안내와 '다시 시도'를 보여준다(반쪽 렌더 금지)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(
                `${ORIGIN}/api/projects/cards`,
                () => HttpResponse.json({ success: false, data: null, error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 }),
            ),
        );

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
        expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    });

    it("집필 리듬 카드 — 이번 주 합계와 요일 막대, 작품별 누적 막대를 보여준다(US3 v4)", async () => {
        stubAuthed();
        stubWeekly({ 0: 12_000_000 });
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json(
                    { success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z", { totalDurationMs: 7_200_000 })], error: null },
                ),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        expect(await screen.findByText("이번 주")).toBeInTheDocument();
        expect(await screen.findByText("3시간 20분")).toBeInTheDocument();
        expect(screen.getByText(/작품별 쌓인 시간/)).toBeInTheDocument();
        expect(screen.getByText("2시간")).toBeInTheDocument();
    });

    it("이번 주 0분이면 리듬 카드 합계 자리에 '기록 없음'(카드는 유지)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        expect(await screen.findByText("이번 주")).toBeInTheDocument();
        expect(await screen.findByText("기록 없음")).toBeInTheDocument();
    });

    it("주간 조회가 실패하면 전체 에러 상태로 처리한다(반쪽 렌더 금지)", async () => {
        stubAuthed();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
            http.get(
                `${ORIGIN}/api/work-sessions/total`,
                () => HttpResponse.json({ success: false, data: null, error: { code: "INTERNAL_ERROR", message: "x" } }, { status: 500 }),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    });

    it("최근작을 제외한 나머지 작품을 미니 카드로 보여주고, 클릭하면 그 작품 집필실로 간다(US4)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({
                    success: true,
                    data: [
                        cardJson(1, "옛 작품", "2026-06-01T00:00:00Z"),
                        cardJson(2, "최신 작품", "2026-06-10T02:00:00Z"),
                        cardJson(3, "중간 작품", "2026-06-05T00:00:00Z"),
                    ],
                    error: null,
                }),
            ),
        );
        stubDocument(1, "옛 문장.");
        stubDocument(2, "최신 문장.");
        stubDocument(3, "중간 문장.");

        renderPage();

        // 최근작(2)은 이어서 쓰기 타일 — 미니 카드는 3, 1 순(저장 시각 내림차순)
        expect(await screen.findByRole("button", { name: /중간 작품/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /옛 작품/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /최신 작품/ })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /중간 작품/ }));
        expect(pushMock).toHaveBeenCalledWith("/projects/3/write");
    });

    it("'모든 작품 보기' 링크는 /library 로 — 작품 1편뿐이면 미니 카드 영역이 비고 새 작품 카드도 없다(US4 v4)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "유일 작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        const link = await screen.findByRole("button", { name: /모든 작품 보기/ });
        expect(screen.queryByRole("button", { name: /유일 작품/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "+ 새 작품" })).not.toBeInTheDocument();

        await userEvent.click(link);
        expect(pushMock).toHaveBeenCalledWith("/library");
    });

    it("최근 메모 3장 + '+ 새 메모'를 보여주고, 메모 클릭은 /memos·새 메모는 빠른 메모 모달(US5 v4)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");
        stubMemos([
            memoJson(1, "가장 오래된 메모", "2026-05-01T00:00:00Z"),
            memoJson(2, "가장 최근 메모", new Date().toISOString()),
            memoJson(3, "중간 메모", "2026-06-08T00:00:00Z"),
            memoJson(4, "오래된 메모", "2026-06-01T00:00:00Z"),
        ]);

        renderPage();

        expect(await screen.findByText(/가장 최근 메모/)).toBeInTheDocument();
        expect(screen.getByText(/중간 메모/)).toBeInTheDocument();
        expect(screen.getByText(/^오래된 메모/)).toBeInTheDocument();
        expect(screen.queryByText(/가장 오래된 메모/)).not.toBeInTheDocument();
        expect(screen.getByText("오늘")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /가장 최근 메모/ }));
        expect(pushMock).toHaveBeenCalledWith("/memos");

        await userEvent.click(screen.getByRole("button", { name: /모든 메모 보기/ }));
        expect(pushMock).toHaveBeenCalledWith("/memos");

        await userEvent.click(screen.getByRole("button", { name: /새 메모/ }));
        expect(await screen.findByRole("dialog", { name: "빠른 메모" })).toBeInTheDocument();
    });

    it("메모가 0장이면 라벨은 유지하고 조용한 빈 문구를 보여준다(US5)", async () => {
        stubAuthed();
        stubWeekly();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");
        stubMemos([]);

        renderPage();

        expect(await screen.findByText("최근 메모")).toBeInTheDocument();
        expect(screen.getByText("아직 메모가 없어요")).toBeInTheDocument();
    });
});
