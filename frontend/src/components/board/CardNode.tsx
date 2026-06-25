"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useBoardActions } from "./boardActions";
import { kindOf } from "./cardKinds";

// 커스텀 노드(React Flow). data 변이(contravariance) 때문에 nodeTypes 할당이 까다로워 NodeProps 는
// 느슨하게 받고 data 를 CardNodeData 로 캐스트한다(런타임은 항상 CardNodeData).

/**
 * 카드(038) — 보드 전용 카드의 표시/편집. 본문은 네이티브 textarea(한글 IME 네이티브).
 * 평상시 본문 말줄임(FR-015), 더블클릭 시 편집. 편집 영역은 `nodrag` 로 캔버스 드래그와 분리.
 * 역할 타입(V25)은 좌측 강조 테두리 + 타입 배지로 구분.
 *
 * 연결(039 트랙 A): 사방 `Handle`(무방향 ConnectionMode.Loose) — 평상시 숨김, hover/선택 시만 노출.
 * 선택 시 "잇기" 버튼(클릭-클릭 모드). 이웃 하이라이트의 비이웃이면 dim(data.dimmed).
 */

export type CardNodeData = {
    body: string;
    /** 역할 타입(plot/character/place/theme/note, V25) */
    kind: string;
    /** 이웃 하이라이트에서 비이웃이면 true → 흐리게(캔버스 주입, 039 트랙 A) */
    dimmed?: boolean;
};

export type CardFlowNode = Node<CardNodeData, "plot">;

// 핸들 id = 앵커(top/right/bottom/left). 연결 시 어느 테두리를 잡았는지 영속(039 트랙 A).
const HANDLE_DEFS = [
    { id: "top", position: Position.Top },
    { id: "right", position: Position.Right },
    { id: "bottom", position: Position.Bottom },
    { id: "left", position: Position.Left },
] as const;

export function CardNode({ id, data, selected }: NodeProps) {
    const body = (data as CardNodeData).body;
    const dimmed = (data as CardNodeData).dimmed ?? false;
    const kind = kindOf((data as CardNodeData).kind);
    const { editCardBody, startConnect } = useBoardActions();
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
            editCardBody(Number(id), next);
        }
    };

    const cancel = () => {
        setText(body);
        setEditing(false);
    };

    // 타입 구분 = 배경 틴트(kind.bg, -50) + 같은 계열 전체 테두리(kind.border, -200). 선택 시 같은 계열 진한 테두리+링.
    const borderClass = selected ? kind.selected : kind.border;
    // 핸들 노출: 평상시 숨김, hover(group-hover)/선택 시만. DOM 에는 항상 존재(연결 동작 위해 display:none 금지).
    const handleVisibility = selected ? "opacity-100" : "opacity-0 group-hover:opacity-100";

    return (
        <div
            className={`group relative w-48 rounded-lg border ${borderClass} ${kind.bg} px-3 py-2 shadow-sm transition-opacity ${dimmed ? "opacity-30" : "opacity-100"}`}
            onDoubleClick={() => setEditing(true)}
        >
            {HANDLE_DEFS.map(({ id: handleId, position }) => (
                <Handle
                    key={handleId}
                    id={handleId}
                    // 무방향(Loose) — 형식상 source 로 두지만 어느 핸들에서나 시작·종료 가능. id=앵커.
                    type="source"
                    position={position}
                    className={`!h-3 !w-3 !border-2 !border-white ${kind.handle} transition-opacity ${handleVisibility}`}
                />
            ))}

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
                        // 편집 중 Backspace/Delete 가 카드 삭제로 전파되지 않게 차단.
                        e.stopPropagation();
                    }}
                    rows={4}
                    placeholder="내용을 적어보세요…"
                    className="nodrag nowheel w-full resize-none rounded border border-gray-200 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none"
                />
            ) : (
                <p className="line-clamp-5 min-h-[1.25rem] text-sm whitespace-pre-wrap break-words text-gray-700">
                    {body.trim().length > 0 ? body : <span className="text-gray-300">(빈 카드 — 더블클릭해 편집)</span>}
                </p>
            )}

            {/* 클릭-클릭 연결 진입 — 카드 바깥 하단에 분리된 은은한 인디케이터(선택 시). */}
            {selected && !editing && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        startConnect(Number(id));
                    }}
                    className="nodrag nopan absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-dashed border-terracotta-400/50 bg-white/60 px-3 py-1 text-[11px] font-semibold text-terracotta-600 shadow-sm backdrop-blur-sm hover:bg-white/90 hover:text-terracotta-700"
                >
                    ↗ 연결할 카드 고르기
                </button>
            )}
        </div>
    );
}
