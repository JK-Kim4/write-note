import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/msw/server";
import LandingPage from "./page";

const ORIGIN = "http://localhost:3000";

// 비로그인 전제(소개 노출) — me 401. next/navigation 은 redirect 호출 없음만 확인.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function wrap(node: ReactNode) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("공개 랜딩 /", () => {
    beforeEach(() => {
        server.use(http.get(`${ORIGIN}/api/auth/me`, () => new HttpResponse(null, { status: 401 })));
    });

    it("히어로 헤드라인과 CTA 2개(가입·로그인)를 보여준다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByRole("heading", { name: /이야기는 그 자리에/ })).toBeInTheDocument();
        // 헤더+히어로 양쪽에 CTA 링크 존재 → 가입은 모두 /auth/signup, 로그인은 모두 /auth/login
        const signupLinks = screen.getAllByRole("link", { name: "무료로 시작하기" });
        expect(signupLinks.length).toBeGreaterThan(0);
        signupLinks.forEach((link) => expect(link).toHaveAttribute("href", "/auth/signup"));
        const loginLinks = screen.getAllByRole("link", { name: "로그인" });
        expect(loginLinks.length).toBeGreaterThan(0);
        loginLinks.forEach((link) => expect(link).toHaveAttribute("href", "/auth/login"));
    });

    it("기능 3개 제목을 보여준다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByText("맥락이 죽지 않아요")).toBeInTheDocument();
        expect(screen.getByText("메모와 집필이 한곳에")).toBeInTheDocument();
        expect(screen.getByText("챕터로 쓰고 내보내기")).toBeInTheDocument();
    });

    it("푸터 문의하기가 /contact 로 연결된다", () => {
        render(wrap(<LandingPage />));
        expect(screen.getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/contact");
    });
});
