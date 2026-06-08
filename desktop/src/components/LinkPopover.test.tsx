import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LinkPopover } from "./LinkPopover";

const projects = [
  { id: "p1", title: "작품 A" },
  { id: "p2", title: "작품 B" },
];

describe("LinkPopover", () => {
  it("should_render_all_projects_with_linked_state", () => {
    render(
      <LinkPopover projects={projects} linkedProjectIds={["p1"]} onToggle={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /작품 A/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /작품 B/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("should_call_onToggle_true_when_linking_unlinked_project", () => {
    const onToggle = vi.fn();
    render(
      <LinkPopover projects={projects} linkedProjectIds={[]} onToggle={onToggle} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /작품 A/ }));
    expect(onToggle).toHaveBeenCalledWith("p1", true);
  });

  it("should_call_onToggle_false_when_unlinking_linked_project", () => {
    const onToggle = vi.fn();
    render(
      <LinkPopover projects={projects} linkedProjectIds={["p1"]} onToggle={onToggle} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /작품 A/ }));
    expect(onToggle).toHaveBeenCalledWith("p1", false);
  });

  it("should_show_empty_guidance_when_no_projects", () => {
    render(<LinkPopover projects={[]} linkedProjectIds={[]} onToggle={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/먼저 작품을 만들어/)).toBeInTheDocument();
  });

  it("should_call_onClose_on_escape", () => {
    const onClose = vi.fn();
    render(<LinkPopover projects={projects} linkedProjectIds={[]} onToggle={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
