import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Rail } from "./Rail";

describe("Rail", () => {
  it("4개 화면 네비게이션을 렌더하고 활성 화면을 표시한다", () => {
    render(<Rail active="write" onNavigate={() => {}} onCapture={() => {}} />);

    expect(screen.getByRole("navigation", { name: "화면 전환" })).toBeInTheDocument();
    for (const label of ["작품", "집필", "메모", "기록"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "집필" })).toHaveAttribute("aria-current", "page");
  });

  it("잉크 한 방울 빠른 메모 진입점을 캡처 라벨로 렌더한다", () => {
    const onCapture = vi.fn();
    render(<Rail active="memo" onNavigate={() => {}} onCapture={onCapture} />);

    const capture = screen.getByRole("button", { name: "빠른 메모" });
    expect(capture).toBeInTheDocument();
    expect(capture).toHaveTextContent("잉크 한 방울");

    fireEvent.click(capture);
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("문의 진입점을 렌더하고 클릭 시 contact 화면으로 이동한다", () => {
    const onNavigate = vi.fn();
    render(<Rail active="projects" onNavigate={onNavigate} onCapture={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "문의" }));
    expect(onNavigate).toHaveBeenCalledWith("contact");
  });
});
