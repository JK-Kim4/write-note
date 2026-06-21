import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExportDialog, reorderByDrag } from "./ExportDialog";
import type { ChapterMetaResponse } from "@/types/api";

const chapters: ChapterMetaResponse[] = [
  { id: 1, projectId: 9, title: "제1장", sortOrder: 0, wordCount: 3200, updatedAt: "2026-01-01T00:00:00Z" },
  { id: 2, projectId: 9, title: "제2장", sortOrder: 1, wordCount: 5800, updatedAt: "2026-01-01T00:00:00Z" },
];

describe("ExportDialog", () => {
  // ── 신규: 포맷·합본 모드 ──────────────────────────────────────────
  it("HWPX·DOCX 포맷 버튼이 활성화된다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "HWPX" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "DOCX" })).toBeEnabled();
  });

  it("HWPX 선택 후 내보내기 시 onExportWord 가 format·joinMode 와 함께 호출된다", () => {
    const onExportWord = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={onExportWord} onExportText={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "HWPX" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportWord).toHaveBeenCalledWith("hwpx", { orderedIds: [1, 2], joinMode: "page-title" });
  });

  it("합본 모드 셀렉트를 바꾸면 요청 joinMode 가 반영된다", () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("합본 방식"), { target: { value: "body-only" } });
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], joinMode: "body-only" });
  });

  // ── 복원: toggle / move / canExport 행위 보호 ─────────────────────
  it("열리면 모든 챕터가 기본 선택 상태다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /제1장 포함/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /제2장 포함/ })).toBeChecked();
  });

  it("모든 챕터를 해제하면 내보내기 버튼이 비활성된다", async () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /제1장 포함/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /제2장 포함/ }));
    expect(screen.getByRole("button", { name: "내보내기" })).toBeDisabled();
  });

  it("PDF 형식에서 내보내기를 누르면 선택된 챕터 id를 순서대로 콜백한다", async () => {
    const onExportPdf = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={onExportPdf} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportPdf).toHaveBeenCalledWith({ orderedIds: [1, 2], joinMode: "page-title" });
  });

  it("TXT 선택 후 내보내기 시 onExportText 가 txt 로 호출된다", () => {
    const onExportText = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={onExportText} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "TXT" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportText).toHaveBeenCalledWith("txt", { orderedIds: [1, 2], joinMode: "page-title" });
  });

  it("JSON 선택 후 내보내기 시 onExportText 가 json 으로 호출된다", () => {
    const onExportText = vi.fn();
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={onExportText} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "내보내기" }));
    expect(onExportText).toHaveBeenCalledWith("json", { orderedIds: [1, 2], joinMode: "page-title" });
  });

  // ── 순서 변경: 화살표 → 드래그앤드롭(@dnd-kit) 전환. 실제 드래그는 dogfooding 게이트(jsdom 미지원),
  //    순서 매핑(reorderByDrag)만 순수 단위테스트로 보호.
  it("reorderByDrag — active 를 over 위치로 이동", () => {
    expect(reorderByDrag([1, 2], 1, 2)).toEqual([2, 1]);
    expect(reorderByDrag([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
  });

  it("reorderByDrag — 같은 위치/미존재 id 는 순서 불변", () => {
    expect(reorderByDrag([1, 2], 1, 1)).toEqual([1, 2]);
    expect(reorderByDrag([1, 2], 9, 2)).toEqual([1, 2]);
  });

  it("드래그 핸들은 챕터가 2개 이상일 때 렌더된다", () => {
    render(<ExportDialog open chapters={chapters} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /제1장 순서 변경 핸들/ })).toBeInTheDocument();
  });

  it("챕터가 1개면 드래그 핸들이 없다(바꿀 순서 없음)", () => {
    const { unmount } = render(
      <ExportDialog open chapters={[chapters[0]]} paperSize="A4" onExportPdf={vi.fn()} onExportWord={vi.fn()} onExportText={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /순서 변경 핸들/ })).not.toBeInTheDocument();
    unmount();
  });
});
