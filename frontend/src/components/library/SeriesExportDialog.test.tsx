import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeriesExportDialog } from "./SeriesExportDialog";
import type { ProjectCard } from "@/lib/types/domain";

function card(id: number, title: string): ProjectCard {
    return {
        id, title, genre: null, targetLength: null, toneNotes: null, synopsis: null, worldNotes: null,
        nextScene: "", categoryId: 9, paperSize: "A4", layoutMode: "paper", effectivePaperSize: "A4",
        effectiveLayoutMode: "paper", fontScale: "m", archivedAt: null, createdAt: "2026-06-23T00:00:00Z",
        updatedAt: "2026-06-23T00:00:00Z", lastSentenceSource: "", wordCount: 0, docUpdatedAt: "2026-06-23T00:00:00Z", totalDurationMs: 0,
    };
}
const works = [card(11, "1장"), card(22, "2장"), card(33, "3장")];

describe("SeriesExportDialog", () => {
    it("기본 전체 선택 + 순서대로 projectId 를 제출한다", () => {
        const onSubmit = vi.fn();
        render(<SeriesExportDialog open works={works} seriesName="시집" onSubmit={onSubmit} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: "PDF" }));
        fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(onSubmit).toHaveBeenCalledWith({ orderedProjectIds: [11, 22, 33], joinMode: "page-title", target: { kind: "pdf" } });
    });

    it("작품 체크 해제 시 제외된다", () => {
        const onSubmit = vi.fn();
        render(<SeriesExportDialog open works={works} seriesName="시집" onSubmit={onSubmit} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("checkbox", { name: /2장/ })); // 해제
        fireEvent.click(screen.getByRole("button", { name: "PDF" }));
        fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
        expect(onSubmit).toHaveBeenCalledWith({ orderedProjectIds: [11, 33], joinMode: "page-title", target: { kind: "pdf" } });
    });

    // 순서 변경은 @dnd-kit 드래그(손잡이 ⠿)로 동작 — RTL 포인터 시뮬이 복잡해 dogfooding 게이트로 검증한다(arrayMove 로직은 dnd-kit 제공).
});
