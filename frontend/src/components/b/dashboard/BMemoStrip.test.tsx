import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BMemoStrip } from "./BMemoStrip";

const memos = [
    { id: 1, body: "3장 복선 회수", dateLabel: "방금" },
    { id: 2, body: "주인공 말투 통일", dateLabel: "1시간 전" },
];

it("최근 메모를 표시하고 새 메모 버튼으로 onNew를 호출한다", async () => {
    const onNew = vi.fn();
    render(<BMemoStrip memos={memos} onNew={onNew} onOpenAll={() => {}} />);
    expect(screen.getByText("3장 복선 회수")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /새 메모/ }));
    expect(onNew).toHaveBeenCalledOnce();
});

it("메모가 없으면 빈 안내를 표시한다", () => {
    render(<BMemoStrip memos={[]} onNew={() => {}} onOpenAll={() => {}} />);
    expect(screen.getByText(/아직 메모가 없어요/)).toBeInTheDocument();
});
