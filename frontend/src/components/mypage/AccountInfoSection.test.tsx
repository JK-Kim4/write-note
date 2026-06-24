import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AccountInfoSection } from "./AccountInfoSection";

describe("AccountInfoSection", () => {
    it("이메일과 가입일을 표시한다", () => {
        render(
            <AccountInfoSection email="user@example.com" kakaoLinked={false} createdAt="2026-05-20T10:00:00Z" /> as ReactNode,
        );
        expect(screen.getByText("user@example.com")).toBeInTheDocument();
        expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it("카카오 가입 사용자는 가입 방식을 카카오로 표시한다", () => {
        render(
            <AccountInfoSection email="k@example.com" kakaoLinked={true} createdAt="2026-05-20T10:00:00Z" /> as ReactNode,
        );
        expect(screen.getByText("카카오")).toBeInTheDocument();
    });

    it("가입일이 없으면 대시로 표시한다", () => {
        render(<AccountInfoSection email="a@b.com" kakaoLinked={false} createdAt={null} /> as ReactNode);
        expect(screen.getByText("—")).toBeInTheDocument();
    });
});
