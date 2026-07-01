import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyContent } from "./PrivacyContent";

describe("PrivacyContent", () => {
    it("개인정보처리방침 핵심 섹션을 렌더한다", () => {
        render(<PrivacyContent />);
        expect(screen.getByRole("heading", { name: "개인정보처리방침", level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "8. 개인정보 보호책임자", level: 2 })).toBeInTheDocument();
        expect(screen.getByText("jongbell4@gmail.com")).toBeInTheDocument();
    });
});
