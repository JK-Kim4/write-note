import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { BWorkMiniCard } from "./BWorkMiniCard";

function card(over: Partial<ProjectCard> = {}): ProjectCard {
    return {
        id: 5,
        title: "달밤의 약속",
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "재회",
        paperSize: "A4",
        archivedAt: null,
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        lastSentenceSource: "그녀는 끝내 문을 열지 않았다.",
        wordCount: 38420,
        docUpdatedAt: "2026-06-12T00:00:00Z",
        totalDurationMs: 0,
        ...over,
    };
}

describe("BWorkMiniCard", () => {
    it("targetLength가 null이면 게이지를 렌더하지 않는다", () => {
        render(<BWorkMiniCard card={card({ targetLength: null })} onOpen={() => {}} />);
        expect(screen.queryByRole("progressbar")).toBeNull();
    });
    it("targetLength가 있으면 달성률 게이지를 렌더한다", () => {
        render(<BWorkMiniCard card={card({ wordCount: 25000, targetLength: 50000 })} onOpen={() => {}} />);
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    });
    it("목표를 초과해도 aria-valuenow는 100으로 클램프한다", () => {
        render(<BWorkMiniCard card={card({ wordCount: 60000, targetLength: 50000 })} onOpen={() => {}} />);
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    });
    it("제목과 마지막 문장을 표시하고 클릭 시 onOpen을 호출한다", async () => {
        const onOpen = vi.fn();
        render(<BWorkMiniCard card={card()} onOpen={onOpen} />);
        expect(screen.getByText("달밤의 약속")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button"));
        expect(onOpen).toHaveBeenCalledOnce();
    });
});
