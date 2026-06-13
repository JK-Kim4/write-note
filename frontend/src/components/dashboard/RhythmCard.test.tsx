import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { RhythmCard } from "./RhythmCard";

/** RhythmCard(018 v4 ③) 행위 — 주간 요일 막대 + 작품별 누적 막대. 표시 전용, 평가 장치 없음. */

function card(id: number, title: string, totalDurationMs: number): ProjectCard {
    return {
        id,
        title,
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        paperSize: "A4",
        archivedAt: null,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        lastSentenceSource: "",
        wordCount: 0,
        docUpdatedAt: "2026-06-01T00:00:00Z",
        totalDurationMs,
    };
}

const HOUR = 3_600_000;

describe("RhythmCard", () => {
    it("이번 주 합계와 요일 라벨(월~일, 오늘 강조)을 표시한다", () => {
        render(<RhythmCard dayMs={[2 * HOUR, 0, HOUR + 20 * 60_000, 0, 0, 0, 0]} todayIndex={2} cards={[card(1, "여름의 끝", HOUR)]} />);

        expect(screen.getByText("이번 주")).toBeInTheDocument();
        expect(screen.getByText("3시간 20분")).toBeInTheDocument();
        for (const day of ["월", "화", "수", "목", "금", "토", "일"]) {
            expect(screen.getByText(day)).toBeInTheDocument();
        }
        expect(screen.getByText("수").className).toContain("today");
    });

    it("이번 주 0분이면 합계 자리에 '기록 없음'", () => {
        render(<RhythmCard dayMs={[0, 0, 0, 0, 0, 0, 0]} todayIndex={0} cards={[card(1, "작품", HOUR)]} />);

        expect(screen.getByText("기록 없음")).toBeInTheDocument();
    });

    it("작품별 누적을 내림차순으로 총합과 함께 표시하고, 누적 0 작품은 행을 생략한다", () => {
        render(
            <RhythmCard
                dayMs={[HOUR, 0, 0, 0, 0, 0, 0]}
                todayIndex={0}
                cards={[card(1, "조금 쓴 작품", HOUR), card(2, "많이 쓴 작품", 3 * HOUR), card(3, "빈 작품", 0)]}
            />,
        );

        expect(screen.getByText(/총 4시간/)).toBeInTheDocument();
        const names = screen.getAllByText(/쓴 작품/).map((el) => el.textContent);
        expect(names).toEqual(["많이 쓴 작품", "조금 쓴 작품"]);
        expect(screen.queryByText("빈 작품")).not.toBeInTheDocument();
    });

    it("누적이 전부 0이면 작품별 절을 생략한다", () => {
        render(<RhythmCard dayMs={[HOUR, 0, 0, 0, 0, 0, 0]} todayIndex={0} cards={[card(1, "작품", 0)]} />);

        expect(screen.queryByText(/작품별 쌓인 시간/)).not.toBeInTheDocument();
    });

    it("평가 장치(%·등급)가 없다", () => {
        render(<RhythmCard dayMs={[HOUR, 0, 0, 0, 0, 0, 0]} todayIndex={0} cards={[card(1, "작품", HOUR)]} />);

        expect(screen.queryByText(/%/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Excellent|달성/)).not.toBeInTheDocument();
    });
});
