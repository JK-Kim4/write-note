"use client";

import { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ChapterMetaResponse } from "@/types/api";
import type { PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL } from "@/components/custom-editor/geometry";
import type { JoinMode } from "@/lib/export/exportDoc";

export type ExportRequest = { orderedIds: number[]; joinMode: JoinMode };

/**
 * 드래그 정렬 결과 순서를 계산한다(순수) — activeId 를 overId 위치로 이동.
 * 실제 드래그 인터랙션은 dogfooding 게이트(jsdom 미지원), 본 매핑만 단위테스트로 보호.
 */
export function reorderByDrag(order: number[], activeId: number, overId: number): number[] {
    const from = order.indexOf(activeId);
    const to = order.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return order;
    return arrayMove(order, from, to);
}

type ExportDialogProps = {
    open: boolean;
    chapters: ChapterMetaResponse[];
    paperSize: PaperSize;
    onExportPdf: (req: ExportRequest) => void;
    onExportWord: (format: "hwpx" | "docx", req: ExportRequest) => void;
    onExportText: (format: "txt" | "json", req: ExportRequest) => void;
    onClose: () => void;
};

type Format = "pdf" | "hwpx" | "docx" | "txt" | "json";
const FORMATS = ["pdf", "hwpx", "docx", "txt", "json"] as const;
const JOIN_MODES: { value: JoinMode; label: string }[] = [
    { value: "page-title", label: "챕터마다 새 페이지 + 제목" },
    { value: "inline-title", label: "연속 + 챕터 제목" },
    { value: "body-only", label: "제목 없이 본문만" },
];

/** 드래그 정렬 가능한 챕터 행 — @dnd-kit useSortable. 드래그 핸들(≡)로만 끌고, 체크박스는 그대로 클릭. */
function SortableChapterRow({
    id,
    title,
    wordCount,
    checked,
    onToggle,
    draggable,
}: {
    id: number;
    title: string;
    wordCount: number;
    checked: boolean;
    onToggle: () => void;
    draggable: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !draggable });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };
    return (
        <li ref={setNodeRef} style={style}>
            {draggable && (
                <button
                    type="button"
                    className="export-dialog__drag-handle"
                    aria-label={`${title} 순서 변경 핸들`}
                    {...attributes}
                    {...listeners}
                >
                    ⠿
                </button>
            )}
            <label>
                <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`${title} 포함`} />
                {title}
            </label>
            <span>{wordCount.toLocaleString()}자</span>
        </li>
    );
}

/**
 * Export 설정창(presentational). 부모는 `{open && <ExportDialog .../>}` 조건부 마운트(stale 방지).
 */
export function ExportDialog({ open, chapters, paperSize, onExportPdf, onExportWord, onExportText, onClose }: ExportDialogProps) {
    const [order, setOrder] = useState<number[]>(() => chapters.map((c) => c.id));
    const [selected, setSelected] = useState<Set<number>>(() => new Set(chapters.map((c) => c.id)));
    const [format, setFormat] = useState<Format>("pdf");
    const [joinMode, setJoinMode] = useState<JoinMode>("page-title");
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    if (!open) return null;

    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over == null || active.id === over.id) return;
        setOrder((prev) => reorderByDrag(prev, Number(active.id), Number(over.id)));
    };

    const orderedSelected = order.filter((id) => selected.has(id));
    const canExport = orderedSelected.length > 0;
    const byId = new Map(chapters.map((c) => [c.id, c]));

    const handleExport = () => {
        if (!canExport) return;
        const req = { orderedIds: orderedSelected, joinMode };
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
                <p className="export-dialog__field-label">내보낼 챕터{order.length > 1 ? " (끌어서 순서 변경)" : ""}</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={order} strategy={verticalListSortingStrategy}>
                        <ul className="export-dialog__chapters">
                            {order.map((id) => {
                                const c = byId.get(id);
                                if (!c) return null;
                                return (
                                    <SortableChapterRow
                                        key={id}
                                        id={id}
                                        title={c.title.trim() || "(제목 없음)"}
                                        wordCount={c.wordCount}
                                        checked={selected.has(id)}
                                        onToggle={() => toggle(id)}
                                        draggable={order.length > 1}
                                    />
                                );
                            })}
                        </ul>
                    </SortableContext>
                </DndContext>
                <label className="export-dialog__field">
                    <span className="export-dialog__field-label">합본 방식</span>
                    <select aria-label="합본 방식" value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)}>
                        {JOIN_MODES.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </label>
                <p className="export-dialog__paper">용지 {PAPER_LABEL[paperSize]} (작품 설정)</p>
                <div className="export-dialog__actions">
                    <button type="button" onClick={handleExport} disabled={!canExport}>내보내기</button>
                    <button type="button" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
}
