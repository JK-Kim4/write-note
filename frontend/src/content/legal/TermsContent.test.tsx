import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TermsContent } from "./TermsContent";

describe("TermsContent", () => {
    it("이용약관 제목과 콘텐츠 저작권 조항을 렌더한다", () => {
        render(<TermsContent />);
        expect(screen.getByRole("heading", { name: "이용약관", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "제7조 (콘텐츠의 저작권)", level: 2 })).toBeInTheDocument();
        expect(screen.getByText(/작성자인 이용자 본인에게 귀속/)).toBeInTheDocument();
    });
});
