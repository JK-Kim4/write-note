"use client";

import { useState } from "react";
import type { PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL } from "@/components/custom-editor/geometry";
import type { JoinMode } from "@/lib/export/exportDoc";

export type ExportRequest = { orderedIds: number[]; joinMode: JoinMode };

/** 내보낼 작품의 단일 본문 메타(033 — 챕터 제거). */
export type ExportDocumentMeta = { id: number; title: string; wordCount: number };

type ExportDialogProps = {
    open: boolean;
    document: ExportDocumentMeta;
    paperSize: PaperSize;
    onExportPdf: (req: ExportRequest) => void;
    onExportWord: (format: "hwpx" | "docx", req: ExportRequest) => void;
    onExportText: (format: "txt" | "json", req: ExportRequest) => void;
    onClose: () => void;
};

type Format = "pdf" | "hwpx" | "docx" | "txt" | "json";
const FORMATS = ["pdf", "hwpx", "docx", "txt", "json"] as const;
const TITLE_MODES: { value: JoinMode; label: string }[] = [
    { value: "page-title", label: "제목을 첫 페이지에 포함" },
    { value: "body-only", label: "제목 없이 본문만" },
];

/**
 * Export 설정창(presentational). 부모는 `{open && <ExportDialog .../>}` 조건부 마운트(stale 방지).
 * 033: 작품 1개 = 본문 1개 — 단일 본문을 백엔드 chapters 배열 계약의 1-element 로 담아 보낸다.
 */
export function ExportDialog({ open, document, paperSize, onExportPdf, onExportWord, onExportText, onClose }: ExportDialogProps) {
    const [format, setFormat] = useState<Format>("pdf");
    // 단일 본문이므로 합본(joinMode)은 제목 포함 여부만 의미가 있다(page-title=포함, body-only=제목 없음).
    const [joinMode, setJoinMode] = useState<JoinMode>("page-title");

    if (!open) return null;

    const handleExport = () => {
        const req = { orderedIds: [document.id], joinMode };
        if (format === "pdf") onExportPdf(req);
        else if (format === "hwpx" || format === "docx") onExportWord(format, req);
        else onExportText(format, req);
    };

    return (
        <div role="dialog" aria-label="내보내기" className="export-dialog">
            <div className="export-dialog__panel">
                <div className="export-dialog__formats">
                    {FORMATS.map((f) => (
                        <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
                <p className="export-dialog__document">
                    {document.title.trim() || "(제목 없음)"} · {document.wordCount.toLocaleString()}자
                </p>
                <label className="export-dialog__field">
                    <span className="export-dialog__field-label">제목 포함</span>
                    <select aria-label="제목 포함" value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)}>
                        {TITLE_MODES.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </label>
                <p className="export-dialog__paper">용지 {PAPER_LABEL[paperSize]} (작품 설정)</p>
                <div className="export-dialog__actions">
                    <button type="button" onClick={handleExport}>내보내기</button>
                    <button type="button" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
}
