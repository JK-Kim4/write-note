import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import LibraryPage from "./page";

/**
 * 작품 벽 /library (018 US1 이동) — 렌더 스모크(행위 보존) + US6 마지막 문장 회복 + US4 ?new=1.
 * 시스템 경계(HTTP)만 msw mock.
 */

const pushMock = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/library",
    useSearchParams: () => searchParams,
}));

const ORIGIN = "http://localhost:3000";

function cardJson(id: number, title: string) {
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
        wordCount: 10,
        documentUpdatedAt: "2026-06-10T02:00:00Z",
        totalDurationMs: 0,
        lastSentenceSource: "",
    };
}

function stubAuthed() {
    server.use(
        http.get(`${ORIGIN}/api/auth/me`, () =>
            HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
        ),
    );
}

function stubCards() {
    server.use(
        http.get(`${ORIGIN}/api/projects/cards`, () =>
            HttpResponse.json({
                success: true,
                data: [{ ...cardJson(1, "여름의 끝"), lastSentenceSource: "바다는 조용했다. 그리고 그녀는 떠났다." }],
                error: null,
            }),
        ),
    );
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <LibraryPage />
        </QueryClientProvider> as ReactNode,
    );
}

describe("LibraryPage(작품 벽 — /library 이동)", () => {
    it("작품 목록을 렌더하고(행위 보존) 본문에서 파생한 마지막 문장을 카드에 표시한다(US6)", async () => {
        searchParams = new URLSearchParams();
        stubAuthed();
        stubCards();

        renderPage();

        expect(await screen.findByText("이어 쓸 작품")).toBeInTheDocument();
        expect(await screen.findByText(/그리고 그녀는 떠났다\./)).toBeInTheDocument();
        expect(screen.queryByText("아직 첫 문장을 기다리는 중")).not.toBeInTheDocument();
    });

    it("본문이 빈 작품은 기존 placeholder 카피를 유지한다(US6)", async () => {
        searchParams = new URLSearchParams();
        stubAuthed();
        server.use(
            http.get(`${ORIGIN}/api/projects/cards`, () =>
                HttpResponse.json({ success: true, data: [cardJson(2, "빈 작품")], error: null }),
            ),
        );

        renderPage();

        expect(await screen.findByText("아직 첫 문장을 기다리는 중")).toBeInTheDocument();
    });

    it("?new=1 이면 새 작품 작성 폼이 바로 열린다(US4)", async () => {
        searchParams = new URLSearchParams("new=1");
        stubAuthed();
        stubCards();

        renderPage();

        expect(await screen.findByText("새 작품을 시작합니다")).toBeInTheDocument();
    });
});
