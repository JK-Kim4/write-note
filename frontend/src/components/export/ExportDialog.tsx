"use client";

import { useState } from "react";
import type { ChapterMetaResponse } from "@/types/api";
import type { PaperSize } from "@/components/editor/pageLayout";
import type { JoinMode } from "@/lib/export/exportDoc";

export type ExportRequest = { orderedIds: number[]; lined: boolean; joinMode: JoinMode };

type ExportDialogProps = {
    open: boolean;
    chapters: ChapterMetaResponse[];
    paperSize: PaperSize;
    onExportPdf: (req: ExportRequest) => void;
    onExportWord: (format: "hwpx" | "docx", req: ExportRequest) => void;
    onClose: () => void;
};

type Format = "pdf" | "hwpx" | "docx";
const FORMATS = ["pdf", "hwpx", "docx"] as const;
const JOIN_MODES: { value: JoinMode; label: string }[] = [
    { value: "page-title", label: "챕터마다 새 페이지 + 제목" },
    { value: "inline-title", label: "연속 + 챕터 제목" },
    { value: "body-only", label: "제목 없이 본문만" },
];

/**
 * Export 설정창(presentational). 부모는 `{open && <ExportDialog .../>}` 조건부 마운트(stale 방지).
 */
export function ExportDialog({ open, chapters, paperSize, onExportPdf, onExportWord, onClose }: ExportDialogProps) {
    const [order, setOrder] = useState<number[]>(() => chapters.map((c) => c.id));
    const [selected, setSelected] = useState<Set<number>>(() => new Set(chapters.map((c) => c.id)));
    const [format, setFormat] = useState<Format>("pdf");
    const [lined, setLined] = useState(false);
    const [joinMode, setJoinMode] = useState<JoinMode>("page-title");

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
        const req = { orderedIds: orderedSelected, lined, joinMode };
        if (format === "pdf") onExportPdf(req);
        else onExportWord(format, req);
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
                <label className="export-dialog__field">
                    <span className="export-dialog__field-label">합본 방식</span>
                    <select aria-label="합본 방식" value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)}>
                        {JOIN_MODES.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </label>
                <label className="export-dialog__option">
                    <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} />
                    줄노트 줄 포함
                </label>
                <p className="export-dialog__paper">용지 {paperSize} (작품 설정)</p>
                <div className="export-dialog__actions">
                    <button type="button" onClick={handleExport} disabled={!canExport}>내보내기</button>
                    <button type="button" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
}
