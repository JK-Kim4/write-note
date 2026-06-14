import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "./ExportDialog";

const chapters = [
    { id: 1, projectId: 9, title: "제1장", sortOrder: 0, wordCount: 3200, updatedAt: "2026-01-01T00:00:00Z" },
    { id: 2, projectId: 9, title: "제2장", sortOrder: 1, wordCount: 5800, updatedAt: "2026-01-01T00:00:00Z" },
];

it("열리면 모든 챕터가 기본 선택 상태다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /제1장 포함/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /제2장 포함/ })).toBeChecked();
});

it("모든 챕터를 해제하면 내보내기 버튼이 비활성된다", async () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /제1장 포함/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /제2장 포함/ }));
    expect(screen.getByRole("button", { name: "내보내기" })).toBeDisabled();
});

it("PDF 형식에서 내보내기를 누르면 선택된 챕터 id를 순서대로 콜백한다", async () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], lined: false });
});
