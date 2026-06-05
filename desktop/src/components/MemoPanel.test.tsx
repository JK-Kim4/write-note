import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InboxMemo } from "../types";
import { MemoPanel } from "./MemoPanel";

function makeMemo(over: Partial<InboxMemo> = {}): InboxMemo {
  return { id: "m1", body: "연결된 메모", dateLabel: "오늘", linkedProjects: [], ...over };
}

describe("MemoPanel", () => {
  it("should_render_linked_memos", () => {
    render(
      <MemoPanel
        memos={[makeMemo({ id: "m1", body: "바다를 처음 본 날" }), makeMemo({ id: "m2", body: "고깃배" })]}
        loading={false}
        onUnlink={vi.fn()}
      />,
    );
    expect(screen.getByText("바다를 처음 본 날")).toBeInTheDocument();
    expect(screen.getByText("고깃배")).toBeInTheDocument();
  });

  it("should_show_empty_state_when_no_linked_memos", () => {
    render(<MemoPanel memos={[]} loading={false} onUnlink={vi.fn()} />);
    expect(screen.getByText(/연결된 메모가/)).toBeInTheDocument();
  });

  it("should_not_show_empty_state_while_loading", () => {
    render(<MemoPanel memos={[]} loading={true} onUnlink={vi.fn()} />);
    expect(screen.queryByText(/연결된 메모가/)).not.toBeInTheDocument();
  });

  it("should_call_onUnlink_when_chip_x_clicked", () => {
    const onUnlink = vi.fn();
    render(<MemoPanel memos={[makeMemo({ id: "m1" })]} loading={false} onUnlink={onUnlink} />);
    fireEvent.click(screen.getByRole("button", { name: "연결 해제" }));
    expect(onUnlink).toHaveBeenCalledWith("m1");
  });
});
