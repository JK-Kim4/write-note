import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import type { CharacterResponse } from "@/types/api";
import { CharacterPanel } from "./CharacterPanel";

/**
 * CharacterPanel 행위 테스트 (017 US2) — 목록·빈 상태·상세 펼침·빠른 추가·상세 링크.
 * 시스템 경계(HTTP)만 mock(msw). 매핑/상태 전이는 실제.
 */

const ORIGIN = "http://localhost:3000";
const PID = 7;

const char = (id: number, name: string, shortDescription: string | null, notes: string | null): CharacterResponse => ({
    id,
    projectId: PID,
    name,
    shortDescription,
    notes,
    age: null,
    gender: null,
    traits: null,
    displayOrder: id,
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
});

const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui: ReactNode = (
        <QueryClientProvider client={client}>
            <CharacterPanel projectId={PID} />
        </QueryClientProvider>
    );
    return render(ui);
}

const listHandler = (chars: CharacterResponse[]) =>
    http.get(`${ORIGIN}/api/projects/${PID}/characters`, () =>
        ok({ content: chars, page: 0, size: 100, totalElements: chars.length, totalPages: 1 }),
    );

describe("CharacterPanel", () => {
    it("등장인물을 이름·한 줄 설명으로 렌더한다", async () => {
        server.use(listHandler([char(1, "주인공", "낯을 가리는 형사", "긴 상세 노트")]));
        renderPanel();
        expect(await screen.findByText("주인공")).toBeInTheDocument();
        expect(screen.getByText("낯을 가리는 형사")).toBeInTheDocument();
    });

    it("인물이 없으면 빈 상태 안내와 빠른 추가 입력을 보여준다", async () => {
        server.use(listHandler([]));
        renderPanel();
        expect(await screen.findByText("곁에 둘 인물을 추가.")).toBeInTheDocument();
        expect(screen.getByLabelText("인물 이름")).toBeInTheDocument();
    });

    it("상세 펼침을 토글하면 상세 노트가 보인다", async () => {
        server.use(listHandler([char(1, "주인공", "형사", "출신은 부산")]));
        renderPanel();
        await screen.findByText("주인공");
        expect(screen.queryByText("출신은 부산")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /주인공 상세/ }));
        expect(screen.getByText("출신은 부산")).toBeInTheDocument();
    });

    it("이름을 입력해 추가하면 POST 후 목록에 반영된다", async () => {
        let created: { name?: string } = {};
        const list: CharacterResponse[] = [];
        server.use(
            http.get(`${ORIGIN}/api/projects/${PID}/characters`, () =>
                ok({ content: list, page: 0, size: 100, totalElements: list.length, totalPages: 1 }),
            ),
            http.post(`${ORIGIN}/api/projects/${PID}/characters`, async ({ request }) => {
                created = (await request.json()) as { name?: string };
                const c = char(99, created.name ?? "", null, null);
                list.push(c);
                return ok(c);
            }),
        );
        renderPanel();
        await screen.findByText("곁에 둘 인물을 추가.");
        await userEvent.type(screen.getByLabelText("인물 이름"), "조연");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));
        await waitFor(() => expect(created.name).toBe("조연"));
        expect(await screen.findByText("조연")).toBeInTheDocument();
    });

    it("추가 실패 시 입력값을 보존하고 에러를 알린다", async () => {
        server.use(
            listHandler([]),
            http.post(`${ORIGIN}/api/projects/${PID}/characters`, () =>
                HttpResponse.json({ success: false, error: { code: "INTERNAL", message: "서버 오류" } }, { status: 500 }),
            ),
        );
        renderPanel();
        await screen.findByText("곁에 둘 인물을 추가.");
        await userEvent.type(screen.getByLabelText("인물 이름"), "조연");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.getByLabelText("인물 이름")).toHaveValue("조연");
    });

    it("이름이 비면 추가 버튼이 비활성이다", async () => {
        server.use(listHandler([]));
        renderPanel();
        await screen.findByText("곁에 둘 인물을 추가.");
        expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    });

    it("상세 화면 링크를 제공한다", async () => {
        server.use(listHandler([char(1, "주인공", "형사", null)]));
        renderPanel();
        await screen.findByText("주인공");
        expect(screen.getByRole("link", { name: /등장인물 관리|전체|상세/ })).toHaveAttribute(
            "href",
            `/projects/${PID}/characters`,
        );
    });
});
