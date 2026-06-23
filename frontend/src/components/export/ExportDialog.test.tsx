import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExportDialog, type ExportDocumentMeta } from "./ExportDialog";

const document: ExportDocumentMeta = { id: 1, title: "내 작품", wordCount: 3200 };

describe("ExportDialog (033 — 단일 본문)", () => {
  it("HWPX·DOCX 포맷 버튼이 활성화된다", () => {
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "HWPX" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "DOCX" })).toBeEnabled();
  });

  it("PDF 형식에서 내보내기를 누르면 단일 본문 id 를 1-element 배열로 콜백한다", () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1], joinMode: "page-title" });
  });

  it("HWPX 선택 후 내보내기 시 onExportWord 가 format·joinMode 와 함께 호출된다", () => {
    const onExportWord = vi.fn();
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={vi.fn()} onExportWord={onExportWord} onExportText={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "HWPX" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportWord).toHaveBeenCalledWith("hwpx", { orderedIds: [1], joinMode: "page-title" });
  });

  it("제목 포함 셀렉트를 바꾸면 요청 joinMode 가 반영된다", () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("제목 포함"), { target: { value: "body-only" } });
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1], joinMode: "body-only" });
  });

  it("TXT 선택 후 내보내기 시 onExportText 가 txt 로 호출된다", () => {
    const onExportText = vi.fn();
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={onExportText} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "TXT" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportText).toHaveBeenCalledWith("txt", { orderedIds: [1], joinMode: "page-title" });
  });

  it("JSON 선택 후 내보내기 시 onExportText 가 json 으로 호출된다", () => {
    const onExportText = vi.fn();
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={onExportText} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportText).toHaveBeenCalledWith("json", { orderedIds: [1], joinMode: "page-title" });
  });

  it("작품 제목·글자수를 표시한다", () => {
    render(<ExportDialog open document={document} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/내 작품/)).toBeInTheDocument();
    expect(screen.getByText(/3,200자/)).toBeInTheDocument();
  });
});
