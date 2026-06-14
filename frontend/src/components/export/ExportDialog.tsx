"use client";

import { useState } from "react";
import type { ChapterMetaResponse } from "@/types/api";
import type { PaperSize } from "@/components/editor/pageLayout";

export type PdfExportRequest = { orderedIds: number[]; lined: boolean };

type ExportDialogProps = {
    open: boolean;
    chapters: ChapterMetaResponse[];
    paperSize: PaperSize;
    onExportPdf: (req: PdfExportRequest) => void;
    onClose: () => void;
};

type Format = "pdf" | "hwpx" | "docx";

export function ExportDialog({ open, chapters, paperSize, onExportPdf, onClose }: ExportDialogProps) {
    const [order, setOrder] = useState<number[]>(() => chapters.map((c) => c.id));
    const [selected, setSelected] = useState<Set<number>>(() => new Set(chapters.map((c) => c.id)));
    const [format, setFormat] = useState<Format>("pdf");
    const [lined, setLined] = useState(false);

    if (!open) return null;

    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const move = (id: number, dir: -1 | 1) =>
        setOrder((prev) => {
            const i = prev.indexOf(id);
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });

    const orderedSelected = order.filter((id) => selected.has(id));
    const canExport = orderedSelected.length > 0;
    const byId = new Map(chapters.map((c) => [c.id, c]));

    const handleExport = () => {
        if (!canExport) return;
        if (format === "pdf") onExportPdf({ orderedIds: orderedSelected, lined });
    };

    return (
        <div role="dialog" aria-label="내보내기" className="export-dialog">
            <div className="export-dialog__formats">
                {(["pdf", "hwpx", "docx"] as const).map((f) => (
                    <button key={f} type="button" aria-pressed={format === f} disabled={f !== "pdf"} onClick={() => setFormat(f)}>
                        {f.toUpperCase()}
                    </button>
                ))}
            </div>
            <ul className="export-dialog__chapters">
                {order.map((id) => {
                    const c = byId.get(id);
                    if (!c) return null;
                    return (
                        <li key={id}>
                            <label>
                                <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={`${c.title} 포함`} />
                                {c.title}
                            </label>
                            <span>{c.wordCount.toLocaleString()}자</span>
                            <button type="button" aria-label={`${c.title} 위로`} onClick={() => move(id, -1)}>⌃</button>
                            <button type="button" aria-label={`${c.title} 아래로`} onClick={() => move(id, 1)}>⌄</button>
                        </li>
                    );
                })}
            </ul>
            <label className="export-dialog__option">
                <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} />
                줄노트 줄 포함
            </label>
            <p className="export-dialog__paper">용지 {paperSize} (작품 설정)</p>
            <button type="button" onClick={handleExport} disabled={!canExport}>내보내기</button>
            <button type="button" onClick={onClose}>닫기</button>
        </div>
    );
}
