import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLoader } from "./BrandLoader";

describe("BrandLoader — 공용 브랜드 로딩 효과", () => {
    it("label 을 주면 그 문구를 화면에 표시한다", () => {
        render(<BrandLoader label="불러오는 중" />);
        expect(screen.getByText("불러오는 중")).toBeInTheDocument();
    });

    it("label 이 없으면 텍스트 문구를 렌더하지 않는다 (C안 — 로고 펄스 + 점만)", () => {
        render(<BrandLoader />);
        expect(screen.queryByTestId("brandloader-label")).toBeNull();
    });

    it("접근성 — role=status + aria-busy 로 로딩 상태를 알린다", () => {
        render(<BrandLoader label="로그인 중" />);
        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-busy", "true");
        expect(status).toHaveAttribute("aria-label", "로그인 중");
    });

    it("label 이 없으면 기본 aria-label '로딩 중' 으로 상태를 알린다", () => {
        render(<BrandLoader />);
        expect(screen.getByRole("status")).toHaveAttribute("aria-label", "로딩 중");
    });
});
