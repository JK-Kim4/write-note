import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingContent } from "@/components/landing/LandingContent";

// 랜딩 마크업(비로그인 노출분) 검증. 인증 쿠키 분기는 app/page.tsx 서버 게이트가 담당(별도).
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("공개 랜딩 콘텐츠", () => {
    it("히어로 헤드라인과 CTA 2개(가입·로그인)를 보여준다", () => {
        render(<LandingContent />);
        expect(screen.getByRole("heading", { name: /이야기는 그 자리에/ })).toBeInTheDocument();
        const signupLinks = screen.getAllByRole("link", { name: "무료로 시작하기" });
        expect(signupLinks.length).toBeGreaterThan(0);
        signupLinks.forEach((link) => expect(link).toHaveAttribute("href", "/auth/signup"));
        const loginLinks = screen.getAllByRole("link", { name: "로그인" });
        expect(loginLinks.length).toBeGreaterThan(0);
        loginLinks.forEach((link) => expect(link).toHaveAttribute("href", "/auth/login"));
    });

    it("기능 3개 제목을 보여준다", () => {
        render(<LandingContent />);
        expect(screen.getByText("맥락이 죽지 않아요")).toBeInTheDocument();
        expect(screen.getByText("메모와 집필이 한곳에")).toBeInTheDocument();
        expect(screen.getByText("챕터로 쓰고 내보내기")).toBeInTheDocument();
    });

    it("푸터 문의하기가 /contact 로 연결된다", () => {
        render(<LandingContent />);
        expect(screen.getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/contact");
    });
});

describe("로그인 사용자에게 보이는 랜딩 콘텐츠", () => {
    it("가입·로그인 CTA 대신 '내 작업실로' 링크(/)를 보여준다", () => {
        render(<LandingContent isAuthenticated />);
        const studioLinks = screen.getAllByRole("link", { name: "내 작업실로" });
        expect(studioLinks.length).toBeGreaterThan(0);
        studioLinks.forEach((link) => expect(link).toHaveAttribute("href", "/"));
        expect(screen.queryByRole("link", { name: "무료로 시작하기" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "로그인" })).not.toBeInTheDocument();
    });

    it("문의하기·개인정보처리방침은 그대로 보여준다", () => {
        render(<LandingContent isAuthenticated />);
        expect(screen.getByRole("link", { name: "문의하기" })).toHaveAttribute("href", "/contact");
        expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
    });
});
