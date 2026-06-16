import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "./ExportDialog";
import type { ChapterMetaResponse } from "@/types/api";

const chapters: ChapterMetaResponse[] = [
  { id: 1, projectId: 9, title: "제1장", sortOrder: 0, wordCount: 3200, updatedAt: "2026-01-01T00:00:00Z" },
  { id: 2, projectId: 9, title: "제2장", sortOrder: 1, wordCount: 5800, updatedAt: "2026-01-01T00:00:00Z" },
];

describe("ExportDialog", () => {
  // ── 신규: 포맷·합본 모드 ──────────────────────────────────────────
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

  // ── 복원: toggle / move / canExport 행위 보호 ─────────────────────
  it("열리면 모든 챕터가 기본 선택 상태다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /제1장 포함/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /제2장 포함/ })).toBeChecked();
  });

  it("모든 챕터를 해제하면 내보내기 버튼이 비활성된다", async () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /제1장 포함/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /제2장 포함/ }));
    expect(screen.getByRole("button", { name: "내보내기" })).toBeDisabled();
  });

  it("PDF 형식에서 내보내기를 누르면 선택된 챕터 id를 순서대로 콜백한다", async () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], lined: false, joinMode: "page-title" });
  });

  it("아래로 버튼으로 순서를 바꾸면 내보내기 순서가 반영된다", async () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "제1장 아래로" }));
    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [2, 1], lined: false, joinMode: "page-title" });
  });

  it("맨 위 챕터의 위로 버튼은 순서를 바꾸지 않는다", async () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "제1장 위로" }));
    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], lined: false, joinMode: "page-title" });
  });
});
