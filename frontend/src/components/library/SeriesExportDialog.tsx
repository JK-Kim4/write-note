"use client";

import { useState } from "react";
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { JoinMode } from "@/lib/export/exportDoc";
import type { ProjectCard } from "@/lib/types/domain";

export type SeriesExportKind =
    | { kind: "pdf" }
    | { kind: "word"; format: "hwpx" | "docx" }
    | { kind: "text"; format: "txt" | "json" };
export type SeriesExportSubmit = { orderedProjectIds: number[]; joinMode: JoinMode; target: SeriesExportKind };

type Props = { open: boolean; works: ProjectCard[]; seriesName: string; onSubmit: (s: SeriesExportSubmit) => void; onClose: () => void };

const FORMATS: { label: string; target: SeriesExportKind }[] = [
    { label: "PDF", target: { kind: "pdf" } },
    { label: "HWPX", target: { kind: "word", format: "hwpx" } },
    { label: "DOCX", target: { kind: "word", format: "docx" } },
    { label: "TXT", target: { kind: "text", format: "txt" } },
    { label: "JSON", target: { kind: "text", format: "json" } },
];

/** 드래그 정렬되는 작품 행 — 손잡이(⠿)만 드래그, 체크박스/제목은 클릭(드래그와 분리). */
function SortableWork({ id, title, checked, onToggle }: { id: number; title: string; checked: boolean; onToggle: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
        <li ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5">
            <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`${title} 포함`} />
            <span className="flex-1 truncate text-sm">{title}</span>
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`${title} 순서 이동`}
                className="cursor-grab px-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing"
            >
                ⠿
            </button>
        </li>
    );
}

export function SeriesExportDialog({ open, works, seriesName, onSubmit, onClose }: Props) {
    // 순서 = order(projectId 배열), 선택 = selected(Set). 기본: works 순서 전체 선택.
    const [order, setOrder] = useState<number[]>(() => works.map((w) => w.id));
    const [selected, setSelected] = useState<Set<number>>(() => new Set(works.map((w) => w.id)));
    const [joinMode, setJoinMode] = useState<JoinMode>("page-title");
    const [formatLabel, setFormatLabel] = useState<string>("PDF");
    // 드래그 6px 이동 후 활성(체크박스 클릭과 충돌 방지, 032 동일) + 키보드 정렬 접근성.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    if (!open) return null;

    const titleOf = (id: number) => works.find((w) => w.id === id)?.title ?? "";
    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (over && active.id !== over.id) {
            setOrder((prev) => arrayMove(prev, prev.indexOf(Number(active.id)), prev.indexOf(Number(over.id))));
        }
    };
    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const submit = () => {
        const orderedProjectIds = order.filter((id) => selected.has(id));
        const target = FORMATS.find((f) => f.label === formatLabel)?.target ?? { kind: "pdf" };
        onSubmit({ orderedProjectIds, joinMode, target });
    };

    return (
        <div role="dialog" aria-label="시리즈 내보내기" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-[28rem] max-w-[92vw] rounded-2xl bg-white p-5 shadow-xl">
                <h2 className="text-base font-bold text-gray-900">{seriesName} 내보내기</h2>
                <p className="mt-1 text-xs text-gray-500">포함할 작품과 순서를 정하세요(손잡이 ⠿ 를 끌어 순서 변경). 선택한 작품이 한 파일로 합쳐집니다.</p>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={order} strategy={verticalListSortingStrategy}>
                        <ul className="mt-3 max-h-60 space-y-1 overflow-auto">
                            {order.map((id) => (
                                <SortableWork key={id} id={id} title={titleOf(id)} checked={selected.has(id)} onToggle={() => toggle(id)} />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>

                <label className="mt-3 block text-xs text-gray-500">
                    소제목(작품 제목)
                    <select value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm">
                        <option value="page-title">작품마다 제목 페이지 포함</option>
                        <option value="body-only">제목 없이 본문만</option>
                    </select>
                </label>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {FORMATS.map((f) => (
                        <button key={f.label} type="button" aria-pressed={formatLabel === f.label} onClick={() => setFormatLabel(f.label)}
                            className={`rounded-md border px-2.5 py-1 text-xs ${formatLabel === f.label ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700" : "border-gray-200 text-gray-600"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600">취소</button>
                    <button type="button" onClick={submit} disabled={order.filter((id) => selected.has(id)).length === 0}
                        className="rounded-md bg-terracotta-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">내보내기</button>
                </div>
            </div>
        </div>
    );
}
