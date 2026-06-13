import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { WorkMiniCard } from "./WorkMiniCard";

/** WorkMiniCard(018 US4 ④) 행위 — 제목 + 마지막 문장(2줄 클램프는 CSS), 카드 전체가 진입 버튼. */

function card(over: Partial<ProjectCard> = {}): ProjectCard {
    return {
        id: 5,
        title: "파란색의 온도",
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
        lastSentenceSource: "그는 한 번도 파란색을 차갑다고 느낀 적이 없었다.",
        wordCount: 1000,
        docUpdatedAt: "2026-06-05T00:00:00Z",
        totalDurationMs: 0,
        ...over,
    };
}

describe("WorkMiniCard", () => {
    it("제목과 본문 마지막 문장을 표시한다", () => {
        render(<WorkMiniCard card={card()} onOpen={() => {}} />);

        expect(screen.getByText("파란색의 온도")).toBeInTheDocument();
        expect(screen.getByText(/차갑다고 느낀 적이 없었다\./)).toBeInTheDocument();
    });

    it("마지막 문장 앞에 … 인디케이터를 붙인다", () => {
        render(<WorkMiniCard card={card()} onOpen={() => {}} />);

        expect(screen.getByText(/^“…/)).toBeInTheDocument();
    });

    it("본문이 비면 … 없이 placeholder 카피만 보여준다", () => {
        render(<WorkMiniCard card={card({ lastSentenceSource: "" })} onOpen={() => {}} />);

        expect(screen.getByText("아직 첫 문장을 기다리는 중")).toBeInTheDocument();
    });

    it("카드 클릭 시 onOpen 을 호출한다(키보드 접근 가능한 button 시맨틱)", async () => {
        const onOpen = vi.fn();
        render(<WorkMiniCard card={card()} onOpen={onOpen} />);

        await userEvent.click(screen.getByRole("button", { name: /파란색의 온도/ }));

        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});
