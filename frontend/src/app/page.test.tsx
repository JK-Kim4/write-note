import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
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

function stubWeekly(totalDurationMs: number) {
    server.use(
        http.get(`${ORIGIN}/api/work-sessions/total`, () =>
            HttpResponse.json({ success: true, data: { totalDurationMs }, error: null }),
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
        stubWeekly(0);
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
        stubWeekly(0);
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({
                    success: true,
                    data: [
                        cardJson(1, "옛 작품", "2026-06-01T00:00:00Z"),
                        cardJson(2, "최신 작품", "2026-06-10T02:00:00Z", { nextScene: "등대 장면" }),
                    ],
                    error: null,
                }),
            ),
        );
        stubDocument(1, "옛 마지막 문장.");
        stubDocument(2, "바다는 조용했다. 최신 마지막 문장이다.");

        renderPage();

        expect(await screen.findByText("최신 작품")).toBeInTheDocument();
        expect(screen.getByText(/최신 마지막 문장이다\./)).toBeInTheDocument();
        expect(screen.getByText(/등대 장면/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
        expect(pushMock).toHaveBeenCalledWith("/projects/2/write");
    });

    it("Rail 에 '홈' 항목이 있고 '작품'은 /library 로 보낸다(FR-008·016)", async () => {
        stubAuthed();
        stubWeekly(0);
        server.use(http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })));

        renderPage();

        expect(await screen.findByRole("button", { name: "홈" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "작품" }));
        expect(pushMock).toHaveBeenCalledWith("/library");
    });

    it("작품이 0편이면 환영 블록과 '첫 작품 시작하기' CTA(→ /library?new=1)를 보여준다", async () => {
        stubAuthed();
        stubWeekly(0);
        server.use(http.get(`${ORIGIN}/api/projects/cards`, () => HttpResponse.json({ success: true, data: [], error: null })));

        renderPage();

        expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "첫 작품 시작하기" }));
        expect(pushMock).toHaveBeenCalledWith("/library?new=1");
    });

    it("카드 조회 실패 시 안내와 '다시 시도'를 보여준다(반쪽 렌더 금지)", async () => {
        stubAuthed();
        stubWeekly(0);
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

    it("이번 주 종료 세션이 있으면 '이번 주 집필 시간' 한 줄을 보여준다(US3)", async () => {
        stubAuthed();
        stubWeekly(12_000_000);
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        expect(await screen.findByText(/이번 주 집필 시간/)).toBeInTheDocument();
        expect(screen.getByText("3시간 20분")).toBeInTheDocument();
    });

    it("이번 주 0분이면 그 줄 자체가 없다(압박 없는 처리)", async () => {
        stubAuthed();
        stubWeekly(0);
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(1, "작품", "2026-06-10T02:00:00Z")], error: null }),
            ),
        );
        stubDocument(1, "문장.");

        renderPage();

        expect(await screen.findByText("작품")).toBeInTheDocument();
        expect(screen.queryByText(/이번 주 집필 시간/)).not.toBeInTheDocument();
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
});
