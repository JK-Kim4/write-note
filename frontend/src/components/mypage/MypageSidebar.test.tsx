import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MypageSidebar } from "./MypageSidebar";

/**
 * 마이페이지 사이드 메뉴 — 메뉴 렌더·활성 강조·회원 탈퇴 분리·문의 링크 (037).
 */
vi.mock("next/navigation", () => ({
    usePathname: () => "/mypage/profile",
}));

function renderSidebar() {
    return render(<MypageSidebar /> as ReactNode);
}

describe("MypageSidebar", () => {
    it("섹션 메뉴와 회원 탈퇴를 렌더한다", () => {
        renderSidebar();
        expect(screen.getByRole("link", { name: "프로필" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "환경설정" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "계정 연결" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "회원 탈퇴" })).toBeInTheDocument();
    });

    it("문의·도움말은 /contact 로 연결된다", () => {
        renderSidebar();
        expect(screen.getByRole("link", { name: "문의·도움말" })).toHaveAttribute("href", "/contact");
    });

    it("현재 섹션(프로필)을 활성으로 강조한다", () => {
        renderSidebar();
        const profile = screen.getByRole("link", { name: "프로필" });
        expect(profile.className).toContain("text-accent-text");
    });
});
