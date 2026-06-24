import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { NicknameSection } from "./NicknameSection";

/**
 * 닉네임 변경 행위 테스트 — 시스템 경계(HTTP)만 msw mock (036 US2).
 */
const ORIGIN = "http://localhost:3000";

function renderSection(current = "기존닉네임") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <NicknameSection currentNickname={current} />
        </QueryClientProvider> as ReactNode,
    );
}

async function submitNickname(text: string) {
    const input = screen.getByLabelText("닉네임");
    await userEvent.clear(input);
    await userEvent.type(input, text);
    await userEvent.click(screen.getByRole("button", { name: "변경" }));
}

describe("NicknameSection", () => {
    it("유효한 닉네임 변경 성공 시 안내를 표시한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/users/me/nickname`, () =>
                HttpResponse.json({
                    success: true,
                    data: {
                        userId: 1,
                        email: "a@b.com",
                        nickname: "새필명",
                        kakaoLinked: false,
                        emailVerifiedAt: null,
                        activeApiTokenCount: 0,
                        createdAt: null,
                    },
                    error: null,
                }),
            ),
        );
        renderSection();
        await submitNickname("새필명");
        expect(await screen.findByText("닉네임을 변경했어요.")).toBeInTheDocument();
    });

    it("이미 사용 중인 닉네임이면 중복 안내를 표시한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/users/me/nickname`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "NICKNAME_ALREADY_REGISTERED", message: "이미 사용 중인 닉네임입니다." } },
                    { status: 409 },
                ),
            ),
        );
        renderSection();
        await submitNickname("점유된닉네임");
        expect(await screen.findByText("이미 사용 중인 닉네임이에요.")).toBeInTheDocument();
    });

    it("형식 위반이면 형식 안내를 표시한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/users/me/nickname`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "NICKNAME_INVALID_FORMAT", message: "형식 오류" } },
                    { status: 400 },
                ),
            ),
        );
        renderSection();
        await submitNickname("ab");
        expect(await screen.findByText("2~16자의 한글·영문·숫자·밑줄만 사용할 수 있어요.")).toBeInTheDocument();
    });

    it("금칙어 포함이면 금칙어 안내를 표시한다", async () => {
        server.use(
            http.patch(`${ORIGIN}/api/users/me/nickname`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "NICKNAME_FORBIDDEN_WORD", message: "금칙어" } },
                    { status: 400 },
                ),
            ),
        );
        renderSection();
        await submitNickname("금칙어닉네임");
        expect(await screen.findByText("사용할 수 없는 단어가 포함되어 있어요.")).toBeInTheDocument();
    });
});
