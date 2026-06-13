import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectCard } from "@/lib/types/domain";
import { BResumeCard } from "./BResumeCard";

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

describe("BResumeCard", () => {
    it("제목·마지막 문장·다음 장면을 표시한다", () => {
        render(<BResumeCard card={card()} onOpen={() => {}} />);
        expect(screen.getByText("달밤의 약속")).toBeInTheDocument();
        expect(screen.getByText(/문을 열지 않았다\./)).toBeInTheDocument();
        expect(screen.getByText(/재회/)).toBeInTheDocument();
    });
    it("[이어 쓰기] 클릭 시 onOpen을 호출한다", async () => {
        const onOpen = vi.fn();
        render(<BResumeCard card={card()} onOpen={onOpen} />);
        await userEvent.click(screen.getByRole("button", { name: /이어 쓰기/ }));
        expect(onOpen).toHaveBeenCalledOnce();
    });
});
