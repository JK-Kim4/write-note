import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BRhythmCard } from "./BRhythmCard";

it("요일 막대 7개를 렌더하고 오늘 인덱스를 강조한다", () => {
    render(<BRhythmCard dayMs={[0, 3600000, 0, 7200000, 1800000, 0, 0]} todayIndex={4} cards={[]} />);
    const bars = screen.getAllByTestId("rhythm-bar");
    expect(bars).toHaveLength(7);
    expect(bars[4]).toHaveAttribute("data-today", "true");
});
