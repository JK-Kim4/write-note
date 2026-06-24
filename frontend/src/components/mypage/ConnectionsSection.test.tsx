import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { ConnectionsSection } from "./ConnectionsSection";

/**
 * 계정 연결 상태 분기 + 비밀번호 추가 (037 US3). 시스템 경계(HTTP)만 msw mock.
 */
const ORIGIN = "http://localhost:3000";

function renderSection(props: { kakaoLinked: boolean; passwordSet: boolean }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ConnectionsSection {...props} />
        </QueryClientProvider> as ReactNode,
    );
}

describe("ConnectionsSection", () => {
    it("이메일 가입자(카카오 미연결)는 카카오 연결 버튼을 노출한다", () => {
        renderSection({ kakaoLinked: false, passwordSet: true });
        expect(screen.getByRole("button", { name: "카카오 연결" })).toBeInTheDocument();
        // 비밀번호 설정됨 → 추가 등록 버튼 없음
        expect(screen.queryByRole("button", { name: "등록" })).not.toBeInTheDocument();
    });

    it("카카오 가입자(비밀번호 미설정)는 비밀번호 추가 등록을 노출한다", () => {
        renderSection({ kakaoLinked: true, passwordSet: false });
        expect(screen.getByRole("button", { name: "등록" })).toBeInTheDocument();
        // 카카오 연결됨 → 카카오 연결 버튼 없음
        expect(screen.queryByRole("button", { name: "카카오 연결" })).not.toBeInTheDocument();
    });

    it("두 수단이 모두 연결되면 추가 액션이 없다", () => {
        renderSection({ kakaoLinked: true, passwordSet: true });
        expect(screen.queryByRole("button", { name: "카카오 연결" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "등록" })).not.toBeInTheDocument();
    });

    it("비밀번호 추가가 이미 설정됨이면 안내를 표시한다", async () => {
        server.use(
            http.post(`${ORIGIN}/api/auth/link/email`, () =>
                HttpResponse.json(
                    { success: false, data: null, error: { code: "PASSWORD_ALREADY_SET", message: "이미 설정됨" } },
                    { status: 409 },
                ),
            ),
        );
        renderSection({ kakaoLinked: true, passwordSet: false });
        await userEvent.type(screen.getByLabelText("추가할 비밀번호"), "Password123");
        await userEvent.click(screen.getByRole("button", { name: "등록" }));
        expect(await screen.findByText("이미 비밀번호가 설정되어 있어요.")).toBeInTheDocument();
    });
});
