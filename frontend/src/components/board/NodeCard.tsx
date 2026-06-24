"use client";

import { useEffect, useRef, useState } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { useBoardActions } from "./boardActions";
import { kindOf } from "./nodeKinds";

// 커스텀 노드. data 변이(contravariance) 때문에 nodeTypes 할당이 까다로워 NodeProps 는 느슨하게
// 받고 data 를 PlotNodeData 로 캐스트한다(런타임은 항상 PlotNodeData).

/**
 * 플롯 노드 카드(038) — 보드 전용 노드의 표시/편집. 본문은 네이티브 textarea(한글 IME 네이티브).
 * 평상시 본문 말줄임(FR-015), 더블클릭 시 편집. 편집 영역은 `nodrag` 로 캔버스 드래그와 분리.
 * 역할 타입(V25)은 좌측 강조 테두리 + 타입 배지로 구분.
 * 연결(엣지) UI 는 보류 — 연결점(Handle) 미노출(추후 논의). 백엔드 엣지 계약은 보존.
 */

export type PlotNodeData = {
    body: string;
    /** 역할 타입(plot/character/place/theme/note, V25) */
    kind: string;
};

export type PlotNode = Node<PlotNodeData, "plot">;

export function NodeCard({ id, data, selected }: NodeProps) {
    const body = (data as PlotNodeData).body;
    const kind = kindOf((data as PlotNodeData).kind);
    const { editNodeBody } = useBoardActions();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(body);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 외부(서버/RF) 본문 변경 시 비편집 상태면 동기화.
    useEffect(() => {
        if (!editing) {
            setText(body);
        }
    }, [body, editing]);

    useEffect(() => {
        if (editing) {
            textareaRef.current?.focus();
        }
    }, [editing]);

    const commit = () => {
        setEditing(false);
        const next = text.trim();
        if (next !== body) {
            editNodeBody(Number(id), next);
        }
    };

    const cancel = () => {
        setText(body);
        setEditing(false);
    };

    const borderClass = selected ? "border-terracotta-500 ring-2 ring-terracotta-200" : "border-gray-300";

    return (
        <div
            className={`w-48 rounded-lg border border-l-4 ${kind.accent} ${borderClass} bg-white px-3 py-2 shadow-sm`}
            onDoubleClick={() => setEditing(true)}
        >
            <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${kind.chip}`}>
                {kind.label}
            </span>
            {editing ? (
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            e.preventDefault();
                            cancel();
                        }
                        // 편집 중 Backspace/Delete 가 노드 삭제로 전파되지 않게 차단.
                        e.stopPropagation();
                    }}
                    rows={4}
                    placeholder="내용을 적어보세요…"
                    className="nodrag nowheel w-full resize-none rounded border border-gray-200 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none"
                />
            ) : (
                <p className="line-clamp-5 min-h-[1.25rem] text-sm whitespace-pre-wrap break-words text-gray-700">
                    {body.trim().length > 0 ? body : <span className="text-gray-300">(빈 노드 — 더블클릭해 편집)</span>}
                </p>
            )}
        </div>
    );
}
