import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { PreferencesSections } from "./PreferencesSections";

/**
 * 환경설정 항목 렌더 — 기존 설정 화면 테스트에서 이관(037, 행위 보존).
 */
describe("PreferencesSections", () => {
    it("일일 작업 목표 select 와 7개 선택지를 렌더한다", () => {
        render(<PreferencesSections /> as ReactNode);
        const select = screen.getByLabelText("일일 작업 목표 시간") as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        expect(select.querySelectorAll("option")).toHaveLength(7);
    });

    it("테마 radiogroup 을 렌더한다", () => {
        render(<PreferencesSections /> as ReactNode);
        expect(screen.getByRole("radiogroup", { name: "테마" })).toBeInTheDocument();
    });
});
