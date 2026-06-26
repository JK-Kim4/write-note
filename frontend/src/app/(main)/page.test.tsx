import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import BDashboardPage from "./page";

/**
 * B형 대시보드(/b) 행위 테스트 — 이어서쓰기 타일·라우팅·빈 상태·에러 (021 Task 7).
 * 시스템 경계(HTTP)만 msw mock.
 */

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
    pushMock.mockClear();
});

const ORIGIN = "http://localhost:3000";

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

function stubCards(cards: unknown[]) {
    server.use(
        http.get(`${ORIGIN}/api/projects/cards`, () =>
            HttpResponse.json({ success: true, data: cards, error: null }),
        ),
    );
}

function stubWeekly() {
    server.use(
        http.get(`${ORIGIN}/api/work-sessions/total`, () =>
            HttpResponse.json({ success: true, data: { totalDurationMs: 0 }, error: null }),
        ),
    );
}

function stubDocument(id: number, text = "마지막 문장.") {
    const body =
        text === ""
            ? "{}"
            : JSON.stringify({
                  type: "doc",
                  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
              });
    server.use(
        http.get(`${ORIGIN}/api/projects/${id}/document`, () =>
            HttpResponse.json({
                success: true,
                data: {
                    id: id * 10,
                    projectId: id,
                    title: "",
                    body,
                    wordCount: 100,
                    version: 0,
                    updatedAt: "2026-06-10T02:00:00Z",
                },
                error: null,
            }),
        ),
    );
}

// 044 보드 중심 전환 — 홈 우측 패널이 메모(/api/memos) 대신 보드(/api/boards/mine)를 조회한다.
function stubBoardsMine(boards: unknown[] = []) {
    server.use(
        http.get(`${ORIGIN}/api/boards/mine`, () =>
            HttpResponse.json({ success: true, data: boards, error: null }),
        ),
    );
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <BDashboardPage />
        </QueryClientProvider> as ReactNode,
    );
}

describe("BDashboardPage(/) 행위", () => {
    it("작품이 있을 때 이어서쓰기 타일이 보이고, [이어 쓰기] 클릭 시 /works/{id} 로 이동한다", async () => {
        stubCards([cardJson(42, "B작품", "2026-06-10T02:00:00Z", { nextScene: "바다 장면" })]);
        stubDocument(42, "마지막 문장 예시.");
        stubWeekly();
        stubBoardsMine();

        renderPage();

        // 이어서쓰기 타일 노출 확인
        expect(await screen.findByText("B작품")).toBeInTheDocument();

        // 이어 쓰기 버튼 클릭 → /works/42
        await userEvent.click(screen.getByRole("button", { name: /이어 쓰기/ }));
        expect(pushMock).toHaveBeenCalledWith("/works/42");
    });

    it("작품이 0개일 때 '작업실이 준비됐습니다' + '첫 작품 시작하기'가 보이고 클릭 시 /library?new=1 push", async () => {
        stubCards([]);
        stubWeekly();
        stubBoardsMine();

        renderPage();

        expect(await screen.findByText("작업실이 준비됐습니다")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "첫 작품 시작하기" }));
        expect(pushMock).toHaveBeenCalledWith("/library?new=1");
    });

    it("cardsQuery 에러일 때 role=alert 와 '다시 시도' 버튼이 보인다", async () => {
        server.use(
            http.get(
                `${ORIGIN}/api/projects/cards`,
                () =>
                    HttpResponse.json(
                        { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "x" } },
                        { status: 500 },
                    ),
            ),
        );
        stubWeekly();
        stubBoardsMine();

        renderPage();

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
    });
});
