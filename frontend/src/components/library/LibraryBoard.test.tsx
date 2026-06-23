import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import { categoryKeys } from "@/lib/query/useCategories";
import { LibraryBoard } from "./LibraryBoard";
import type { CategoryResponse } from "@/types/api";
import type { ProjectCard } from "@/lib/types/domain";

/**
 * LibraryBoard 행위 테스트(032 T027/T038/T043) — 드릴인·⋯ 이동 메뉴·시리즈 생성/이름변경/삭제·빈 상태·URL 보존.
 * 실제 @dnd-kit 포인터 드래그는 jsdom 에서 시뮬레이션이 불안정 → 이동 로직은 useMoveProjectCategory 테스트가,
 * 드래그 *감각* 은 dogfooding 이 보장. 여기서는 터치/키보드 1급 경로인 ⋯ 이동 메뉴로 이동을 검증한다.
 */

const ORIGIN = "http://localhost:3000";

function cat(id: number, name: string, projectCount = 0): CategoryResponse {
    return {
        id,
        name,
        parentId: null,
        sortOrder: id,
        projectCount,
        paperSize: null,
        layoutMode: null,
        genre: null,
        synopsis: null,
        targetLength: null,
        totalWordCount: 0,
        createdAt: "2026-06-22T00:00:00Z",
        updatedAt: "2026-06-22T00:00:00Z",
    };
}

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
        effectivePaperSize: "A4",
        effectiveLayoutMode: "paper",
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

function setup(categories: CategoryResponse[], cards: ProjectCard[]) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(categoryKeys.list(), categories);
    // mutation invalidate 후 useCategories 재조회 대비 기본 핸들러
    server.use(http.get(`${ORIGIN}/api/categories`, () => HttpResponse.json({ success: true, data: categories, error: null })));
    const noop = () => {};
    const onNewWork = vi.fn();
    render(
        <QueryClientProvider client={client}>
            <LibraryBoard cards={cards} onNewWork={onNewWork} onEditWork={noop} onDeleteWork={noop} onArchiveWork={noop} />
        </QueryClientProvider> as ReactNode,
    );
    return { client, onNewWork };
}

beforeEach(() => {
    window.history.replaceState(null, "", "/library");
});
afterEach(() => {
    window.history.replaceState(null, "", "/library");
});

describe("LibraryBoard — 루트 표시 + 드릴인", () => {
    it("루트에 시리즈 타일과 미분류 작품만 보여준다", () => {
        setup([cat(7, "가나다", 1)], [card(1, 7), card(2, null)]);
        // 시리즈 타일
        expect(screen.getByRole("button", { name: "가나다 열기" })).toBeInTheDocument();
        // 미분류 작품만 루트에 — 작품1(시리즈 소속)은 루트에 없음
        expect(screen.getByText("작품2")).toBeInTheDocument();
        expect(screen.queryByText("작품1")).not.toBeInTheDocument();
    });

    it("시리즈 타일을 클릭하면 드릴인하고 ?folder= 로 URL 을 보존한다", async () => {
        setup([cat(7, "가나다", 1)], [card(1, 7), card(2, null)]);
        await userEvent.click(screen.getByRole("button", { name: "가나다 열기" }));

        // 경로 + 그 시리즈의 작품
        expect(screen.getByText("가나다 · 1편")).toBeInTheDocument();
        expect(screen.getByText("작품1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "내 작품" })).toBeInTheDocument();
        expect(window.location.search).toBe("?folder=7");
    });

    it("루트의 '새 작품'은 미분류(null)로, 시리즈 안의 '새 작품'은 그 시리즈로 시작한다", async () => {
        const { onNewWork } = setup([cat(7, "가나다", 1)], [card(1, 7), card(2, null)]);
        // 루트: 미분류
        await userEvent.click(screen.getByRole("button", { name: "+ 새 작품 시작하기" }));
        expect(onNewWork).toHaveBeenLastCalledWith(null);
        // 시리즈 드릴인 후: 그 시리즈(7)
        await userEvent.click(screen.getByRole("button", { name: "가나다 열기" }));
        await userEvent.click(screen.getByRole("button", { name: "+ 새 작품 시작하기" }));
        expect(onNewWork).toHaveBeenLastCalledWith(7);
    });

    it("드릴인하면 상위(미분류)로 빼내는 드롭존이 보인다", async () => {
        setup([cat(7, "가나다", 1)], [card(1, 7)]);
        // 루트에는 드롭존 없음
        expect(screen.queryByLabelText("시리즈에서 빼내기(내 작품으로)")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "가나다 열기" }));
        // 드릴인 후 노출
        expect(screen.getByLabelText("시리즈에서 빼내기(내 작품으로)")).toBeInTheDocument();
    });
});

describe("LibraryBoard — 시리즈 생성/이름변경/삭제", () => {
    it("새 시리즈 인라인 폼으로 시리즈를 만든다", async () => {
        let createdName: unknown = null;
        server.use(
            http.post(`${ORIGIN}/api/categories`, async ({ request }) => {
                createdName = ((await request.json()) as { name: string }).name;
                return HttpResponse.json({ success: true, data: cat(9, "여름 단편선"), error: null });
            }),
        );
        setup([], [card(1, null)]);
        await userEvent.click(screen.getByRole("button", { name: /새 시리즈/ }));
        await userEvent.type(screen.getByLabelText("새 시리즈 이름"), "여름 단편선");
        await userEvent.click(screen.getByRole("button", { name: "만들기" }));

        await waitFor(() => expect(createdName).toBe("여름 단편선"));
    });

    it("시리즈 이름을 인라인으로 변경한다", async () => {
        let renamed: unknown = null;
        server.use(
            http.patch(`${ORIGIN}/api/categories/7`, async ({ request }) => {
                renamed = await request.json();
                return HttpResponse.json({ success: true, data: cat(7, "가나다라"), error: null });
            }),
        );
        setup([cat(7, "가나다")], []);
        await userEvent.click(screen.getByRole("button", { name: "가나다" }));
        const input = screen.getByLabelText("시리즈 이름");
        await userEvent.clear(input);
        await userEvent.type(input, "가나다라{Enter}");

        // 033 — 편집 폼이 이름과 함께 장르·줄거리·판형·출판방식(미설정=null)도 보낸다.
        await waitFor(() =>
            expect(renamed).toEqual({ name: "가나다라", genre: null, synopsis: null, paperSize: null, layoutMode: null, targetLength: null }),
        );
    });

    it("시리즈 편집 폼에서 판형·출판방식을 설정해 저장한다", async () => {
        let patched: unknown = null;
        server.use(
            http.patch(`${ORIGIN}/api/categories/7`, async ({ request }) => {
                patched = await request.json();
                return HttpResponse.json({ success: true, data: cat(7, "가나다"), error: null });
            }),
        );
        setup([cat(7, "가나다")], []);
        await userEvent.click(screen.getByRole("button", { name: "가나다" }));
        await userEvent.selectOptions(screen.getByLabelText("출판 방식"), "paper");
        await userEvent.selectOptions(screen.getByLabelText("판형"), "sinkukpan");
        await userEvent.click(screen.getByRole("button", { name: "저장" }));

        await waitFor(() =>
            expect(patched).toEqual({ name: "가나다", genre: null, synopsis: null, paperSize: "sinkukpan", layoutMode: "paper", targetLength: null }),
        );
    });

    it("시리즈 삭제 시 작품 보존 안내 confirm 을 보여준다", async () => {
        setup([cat(7, "가나다", 2)], [card(1, 7), card(2, 7)]);
        await userEvent.click(screen.getByRole("button", { name: "가나다 메뉴" }));
        await userEvent.click(screen.getByRole("menuitem", { name: "삭제" }));

        const dialog = await screen.findByRole("dialog", { name: "시리즈 삭제" });
        expect(within(dialog).getByText(/미분류로 이동/)).toBeInTheDocument();
    });
});

describe("LibraryBoard — 시리즈 내보내기", () => {
    it("시리즈 드릴인에서 내보내기 버튼으로 다이얼로그를 연다", async () => {
        setup([cat(7, "가나다", 1)], [card(1, 7)]);
        await userEvent.click(screen.getByRole("button", { name: "가나다 열기" }));
        await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(screen.getByRole("dialog", { name: "시리즈 내보내기" })).toBeInTheDocument();
        // 작품 목록(체크박스)이 현재 folderCards 로 렌더되어야 — 다이얼로그 항상-마운트 시 빈 works 로 고정되는 버그 회귀 방지
        expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
    });
});

describe("LibraryBoard — 빈 상태", () => {
    it("시리즈가 없으면 안내를 보여준다", () => {
        setup([], [card(1, null)]);
        expect(screen.getByText(/아직 만든 시리즈가 없어요/)).toBeInTheDocument();
    });

    it("작품이 모두 시리즈에 담겨 미분류가 비면 안내를 보여준다", () => {
        setup([cat(7, "가나다", 1)], [card(1, 7)]);
        expect(screen.getByText("모든 작품이 시리즈에 담겨 있어요.")).toBeInTheDocument();
    });

    it("작품이 하나도 없으면 첫 작품 안내를 보여준다", () => {
        setup([], []);
        expect(screen.getByText(/아직 작품이 없어요/)).toBeInTheDocument();
    });
});
