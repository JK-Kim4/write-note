import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
