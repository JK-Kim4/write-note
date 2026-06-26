import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BBoardStrip } from "./BBoardStrip";

/** 044 홈 보드 패널 — 메모 패널 대체. 목록·빈상태·열기·모두보기·새보드 행위. */
const boards = [
    { id: 7, name: "인물 관계", ownerLabel: "달밤", cardCount: 3 },
    { id: 8, name: "1부 사건", ownerLabel: "아이디어", cardCount: 0 },
];

describe("BBoardStrip", () => {
    it("보드가 없으면 빈 안내를 보여준다", () => {
        render(<BBoardStrip boards={[]} onOpen={() => {}} onOpenAll={() => {}} onNew={() => {}} />);
        expect(screen.getByText("아직 보드가 없어요")).toBeInTheDocument();
    });

    it("최근 보드를 이름·소속·카드수와 함께 보여준다", () => {
        render(<BBoardStrip boards={boards} onOpen={() => {}} onOpenAll={() => {}} onNew={() => {}} />);
        expect(screen.getByText("인물 관계")).toBeInTheDocument();
        expect(screen.getByText("달밤 · 카드 3")).toBeInTheDocument();
    });

    it("보드 클릭=onOpen, 모두 보기=onOpenAll, 새 보드=onNew", async () => {
        const onOpen = vi.fn();
        const onOpenAll = vi.fn();
        const onNew = vi.fn();
        render(<BBoardStrip boards={boards} onOpen={onOpen} onOpenAll={onOpenAll} onNew={onNew} />);
        await userEvent.click(screen.getByRole("button", { name: /인물 관계/ }));
        expect(onOpen).toHaveBeenCalledWith(7);
        await userEvent.click(screen.getByRole("button", { name: "보드 모두 보기" }));
        expect(onOpenAll).toHaveBeenCalledOnce();
        await userEvent.click(screen.getByRole("button", { name: "새 보드 만들기" }));
        expect(onNew).toHaveBeenCalledOnce();
    });
});
