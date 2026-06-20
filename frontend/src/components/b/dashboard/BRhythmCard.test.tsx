import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BRhythmCard } from "./BRhythmCard";

it("요일 막대 7개를 렌더하고 오늘 인덱스를 강조한다", () => {
    render(<BRhythmCard dayMs={[0, 3600000, 0, 7200000, 1800000, 0, 0]} todayIndex={4} cards={[]} />);
    const bars = screen.getAllByTestId("rhythm-bar");
    expect(bars).toHaveLength(7);
    expect(bars[4]).toHaveAttribute("data-today", "true");
});

// 028 US1 — 오늘 날짜+"오늘" 강조
it("오늘 열에 날짜와 '오늘' 표식을 강조해 보여준다", () => {
    render(
        <BRhythmCard dayMs={[3600000, 0, 0, 0, 0, 7200000, 0]} todayIndex={5} todayDateLabel="6/20" cards={[]} />,
    );
    expect(screen.getByText("오늘")).toBeInTheDocument();
    expect(screen.getByText("6/20")).toBeInTheDocument();
});

// 호버 시 그날 작업시간 표시 — 막대 title(접근성·모바일 폴백) + 시각 툴팁
it("각 막대에 그날 작업시간을 표기한다(0은 '기록 없음')", () => {
    render(<BRhythmCard dayMs={[0, 3600000, 9000000, 0, 0, 0, 0]} todayIndex={6} cards={[]} />);
    const bars = screen.getAllByTestId("rhythm-bar");
    expect(bars[0]).toHaveAttribute("title", "기록 없음");
    expect(bars[1]).toHaveAttribute("title", "1시간");
    expect(bars[2]).toHaveAttribute("title", "2시간 30분");
});

// 028 US1 — 빈 주 안내
it("이번 주 기록이 전혀 없으면 빈 상태 안내를 보여준다", () => {
    render(<BRhythmCard dayMs={[0, 0, 0, 0, 0, 0, 0]} todayIndex={5} todayDateLabel="6/20" cards={[]} />);
    expect(screen.getByText("아직 이번 주 기록이 없어요")).toBeInTheDocument();
    expect(screen.queryAllByTestId("rhythm-bar")).toHaveLength(0);
});
