import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExportDialog } from "./ExportDialog";
import type { ChapterMetaResponse } from "@/types/api";

const chapters: ChapterMetaResponse[] = [
  { id: 1, projectId: 9, title: "1장", sortOrder: 0, wordCount: 100, updatedAt: "2026-06-16T00:00:00Z" },
  { id: 2, projectId: 9, title: "2장", sortOrder: 1, wordCount: 200, updatedAt: "2026-06-16T00:00:00Z" },
];

describe("ExportDialog", () => {
  it("HWPX·DOCX 포맷 버튼이 활성화된다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "HWPX" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "DOCX" })).toBeEnabled();
  });

  it("HWPX 선택 후 내보내기 시 onExportWord 가 format·joinMode 와 함께 호출된다", () => {
    const onExportWord = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={onExportWord} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "HWPX" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportWord).toHaveBeenCalledWith("hwpx", { orderedIds: [1, 2], lined: false, joinMode: "page-title" });
  });

  it("합본 모드 셀렉트를 바꾸면 요청 joinMode 가 반영된다", () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("합본 방식"), { target: { value: "body-only" } });
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], lined: false, joinMode: "body-only" });
  });
});
