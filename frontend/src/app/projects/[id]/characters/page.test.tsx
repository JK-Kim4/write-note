import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import CharactersPage from "./page";

/**
 * 등장인물 페이지 행위 테스트 (US4) — 생성 후 목록 갱신 / reorder 순서 반영 / 검증 실패 400 표시.
 */

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "42" }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const ORIGIN = "http://localhost:3000";

function renderWithClient(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function character(id: number, name: string, displayOrder: number) {
    return {
        id,
        projectId: 42,
        name,
        shortDescription: null,
        notes: null,
        displayOrder,
        createdAt: "2026-05-30T00:00:00Z",
        updatedAt: "2026-05-30T00:00:00Z",
    };
}

function page(content: ReturnType<typeof character>[]) {
    return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
}

const ME = http.get(`${ORIGIN}/api/auth/me`, () =>
    HttpResponse.json({ success: true, data: { userId: 1, email: "a@b.com" }, error: null }),
);

describe("CharactersPage", () => {
    it("이름 입력 후 추가하면 목록에 표시된다", async () => {
        let created = false;
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json({ success: true, data: page(created ? [character(1, "홍길동", 0)] : []), error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/42/characters`, () => {
                created = true;
                return HttpResponse.json({ success: true, data: character(1, "홍길동", 0), error: null }, { status: 201 });
            }),
        );
        renderWithClient(<CharactersPage />);

        await userEvent.type(screen.getByLabelText("이름 *"), "홍길동");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));

        expect(await screen.findByText("홍길동")).toBeInTheDocument();
    });

    it("이름 누락 외 검증 실패(400) 시 서버 메시지를 표시한다", async () => {
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json({ success: true, data: page([]), error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "VALIDATION_FAILED", message: "이미 같은 이름의 인물이 있습니다" } },
                    { status: 400 },
                ),
            ),
        );
        renderWithClient(<CharactersPage />);

        await userEvent.type(screen.getByLabelText("이름 *"), "중복이름");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("이미 같은 이름의 인물이 있습니다");
    });

    it("나이·성별·특징을 입력해 추가하면 요청 본문에 담긴다", async () => {
        let body: Record<string, unknown> | null = null;
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json({ success: true, data: page([]), error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/42/characters`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ success: true, data: character(1, "민지", 0), error: null }, { status: 201 });
            }),
        );
        renderWithClient(<CharactersPage />);

        await userEvent.type(screen.getByLabelText("이름 *"), "민지");
        await userEvent.type(screen.getByLabelText("나이"), "17세 가량");
        await userEvent.selectOptions(screen.getByLabelText("성별"), "FEMALE");
        await userEvent.type(screen.getByLabelText("특징"), "말수가 적다");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));

        await waitFor(() => expect(body).not.toBeNull());
        expect(body).toMatchObject({ name: "민지", age: "17세 가량", gender: "FEMALE", traits: "말수가 적다" });
    });

    it("성별을 선택하지 않으면 gender 가 null 로 전송된다(비움 허용)", async () => {
        let body: Record<string, unknown> | null = null;
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json({ success: true, data: page([]), error: null }),
            ),
            http.post(`${ORIGIN}/api/projects/42/characters`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return HttpResponse.json({ success: true, data: character(1, "구상중", 0), error: null }, { status: 201 });
            }),
        );
        renderWithClient(<CharactersPage />);

        await userEvent.type(screen.getByLabelText("이름 *"), "구상중");
        await userEvent.click(screen.getByRole("button", { name: "추가" }));

        await waitFor(() => expect(body).not.toBeNull());
        expect(body).toMatchObject({ name: "구상중", gender: null });
    });

    it("아래로 이동 시 reorder 요청을 보내고 응답 순서로 갱신한다", async () => {
        let reorderedIds: number[] | undefined;
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json({ success: true, data: page([character(1, "A", 0), character(2, "B", 1)]), error: null }),
            ),
            http.put(`${ORIGIN}/api/projects/42/characters/reorder`, async ({ request }) => {
                const body = (await request.json()) as { characterIds: number[] };
                reorderedIds = body.characterIds;
                return HttpResponse.json(
                    { success: true, data: page([character(2, "B", 0), character(1, "A", 1)]), error: null },
                    { status: 200 },
                );
            }),
        );
        renderWithClient(<CharactersPage />);

        await screen.findByText("A");
        const downButtons = screen.getAllByLabelText("아래로");
        await userEvent.click(downButtons[0]);

        await waitFor(() => expect(reorderedIds).toEqual([2, 1]));
    });

    it("삭제된 작품으로 진입하면 빈 목록 대신 찾을 수 없음 안내를 보여준다 (019 버그픽스 후속)", async () => {
        server.use(
            ME,
            http.get(`${ORIGIN}/api/projects/42/characters`, () =>
                HttpResponse.json(
                    {
                        success: false,
                        data: null,
                        error: { code: "RESOURCE_NOT_FOUND", message: "Project not found" },
                    },
                    { status: 404 },
                ),
            ),
        );
        renderWithClient(<CharactersPage />);

        expect(await screen.findByText("프로젝트를 찾을 수 없습니다")).toBeInTheDocument();
        // 인물 추가 폼(빈 상태 UI)은 노출되지 않는다
        expect(screen.queryByText("새 등장인물")).not.toBeInTheDocument();
    });
});
