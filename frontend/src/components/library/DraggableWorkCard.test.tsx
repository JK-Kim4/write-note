import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { DraggableWorkCard } from "./DraggableWorkCard";
import type { ProjectCard } from "@/lib/types/domain";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

function makeCard(overrides: Partial<ProjectCard> = {}): ProjectCard {
    return {
        id: 1,
        title: "테스트 작품",
        genre: null,
        targetLength: null,
        toneNotes: null,
        synopsis: null,
        worldNotes: null,
        nextScene: "",
        categoryId: null,
        paperSize: "A4",
        layoutMode: "paper",
        effectivePaperSize: "A4",
        effectiveLayoutMode: "paper",
        fontScale: "m",
        archivedAt: null,
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
        lastSentenceSource: "",
        wordCount: 500,
        docUpdatedAt: "2026-01-15T00:00:00Z",
        totalDurationMs: (1 * 3600 + 30 * 60) * 1000, // 1시간 30분
        ...overrides,
    };
}

function renderCard(card: ProjectCard, overlay = false) {
    return render(
        <DndContext>
            <DraggableWorkCard
                card={card}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
                onArchive={vi.fn()}
                overlay={overlay}
            />
        </DndContext>,
    );
}

describe("DraggableWorkCard — 호버 말풍선", () => {
    it("overlay=false 일 때 tooltip 에 생성일·집필시간이 표시된다", () => {
        renderCard(makeCard());
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip.textContent).toContain("생성");
        expect(tooltip.textContent).toContain("집필 시간");
        expect(tooltip.textContent).toContain("1시간 30분");
        expect(tooltip.textContent).toContain("2026.01.15");
    });

    it("overlay=true 일 때 tooltip 이 렌더되지 않는다", () => {
        renderCard(makeCard(), true);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("totalDurationMs=0 이면 '0분' 이 표시된다", () => {
        renderCard(makeCard({ totalDurationMs: 0 }));
        const tooltip = screen.getByRole("tooltip");
        expect(tooltip.textContent).toContain("0분");
    });
});
