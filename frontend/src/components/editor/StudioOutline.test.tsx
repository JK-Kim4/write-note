import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OutlineItem } from "@/lib/editor/outline";
import { StudioOutline } from "./StudioOutline";

/**
 * StudioOutline 행위 테스트 (017 US1) — 목차 렌더·클릭 점프 호출·빈 상태·현재 섹션 표시.
 * presentational(props 전용) — 에디터 글루는 useEditorOutline 훅이 담당.
 */

const items: OutlineItem[] = [
    { level: 1, text: "1부", index: 0 },
    { level: 2, text: "1장", index: 1 },
    { level: 2, text: "2장", index: 2 },
];

describe("StudioOutline", () => {
    it("목차 항목을 텍스트와 함께 등장 순서대로 렌더한다", () => {
        render(<StudioOutline items={items} activeIndex={null} onSelect={vi.fn()} />);
        const buttons = screen.getAllByRole("button");
        expect(buttons.map((b) => b.textContent)).toEqual(["1부", "1장", "2장"]);
    });

    it("항목을 클릭하면 onSelect 가 해당 항목으로 호출된다", async () => {
        const onSelect = vi.fn();
        render(<StudioOutline items={items} activeIndex={null} onSelect={onSelect} />);
        await userEvent.click(screen.getByRole("button", { name: "2장" }));
        expect(onSelect).toHaveBeenCalledWith(items[2]);
    });

    it("현재 섹션 항목에 aria-current 를 부여한다", () => {
        render(<StudioOutline items={items} activeIndex={1} onSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: "1장" })).toHaveAttribute("aria-current", "true");
        expect(screen.getByRole("button", { name: "1부" })).not.toHaveAttribute("aria-current", "true");
    });

    it("제목이 없으면 작성 유도 안내를 보여준다", () => {
        render(<StudioOutline items={[]} activeIndex={null} onSelect={vi.fn()} />);
        expect(screen.getByText("장면에 큰 제목을 달면 여기 목차가 생겨요.")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
