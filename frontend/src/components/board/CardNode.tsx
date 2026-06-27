"use client";

import { useEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { useBoardActions } from "./boardActions";
import { CARD_KINDS, kindOf } from "./cardKinds";

// 커스텀 노드(React Flow). data 변이(contravariance) 때문에 nodeTypes 할당이 까다로워 NodeProps 는
// 느슨하게 받고 data 를 CardNodeData 로 캐스트한다(런타임은 항상 CardNodeData).

/**
 * 카드(038) — 보드 전용 카드의 표시/편집. 본문은 네이티브 textarea(한글 IME 네이티브).
 * 평상시 본문 말줄임(FR-015), 더블클릭 시 편집. 편집 영역은 `nodrag` 로 캔버스 드래그와 분리.
 *
 * 종류(트랙 D): 4종(인물/장소/사건/테마) + 무지정(null). 무지정은 중립 회색 외관 + "종류 없음" 배지.
 * 생성 시 종류를 안 묻고, 무지정 카드는 선택 시 우측 칩 트레이 자동 노출로 부여(progressive disclosure).
 * 종류 지정 카드는 배지를 눌러야 트레이가 열려 변경/재탭 해제(자동 노출 안 함).
 *
 * 연결(039 트랙 A): 사방 `Handle`(무방향 ConnectionMode.Loose) — 평상시 숨김, hover/선택 시만 노출.
 * 선택 시 "잇기" 버튼(클릭-클릭 모드). 이웃 하이라이트의 비이웃이면 dim(data.dimmed).
 */

export type CardNodeData = {
    body: string;
    /** 역할 종류(character/place/event/theme, 트랙 D). null=무지정 */
    kind: string | null;
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
    const isUntyped = kind.id === null;
    const { editCardBody, startConnect, setCardKind, autoEditCardId, consumeAutoEdit } = useBoardActions();
    // 삭제 — RF deleteElements 로 기존 삭제 파이프라인(onNodesDelete→deleteCardMut) 재사용(키보드 Backspace 와 동일 경로).
    const { deleteElements } = useReactFlow();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(body);
    // 종류 트레이: 무지정 카드는 선택 시 자동, 종류 지정 카드는 배지를 눌러 열었을 때만(trayOpen).
    const [trayOpen, setTrayOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 외부(서버/RF) 본문 변경 시 비편집 상태면 동기화.
    useEffect(() => {
        if (!editing) {
            setText(body);
        }
    }, [body, editing]);

    // 선택 해제되면 배지로 연 트레이는 닫는다(무지정 자동 노출과 분리).
    useEffect(() => {
        if (!selected) {
            setTrayOpen(false);
        }
    }, [selected]);

    useEffect(() => {
        if (editing) {
            textareaRef.current?.focus();
        }
    }, [editing]);

    // 생성 직후 자동 본문 편집 진입(044) — 캔버스가 실제 id 확정 후 autoEditCardId 를 이 카드로 지정하면
    // 편집을 열고 1회성 소비. 기존 더블클릭 편집과 독립.
    useEffect(() => {
        if (autoEditCardId === id && !editing) {
            setEditing(true);
            consumeAutoEdit(Number(id));
        }
    }, [autoEditCardId, id, editing, consumeAutoEdit]);

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

    // 타입 구분 = 배경 틴트(kind.bg, -50) + 같은 계열 전체 테두리(kind.border, -200). 무지정은 slate 중립.
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

            {isUntyped ? (
                <span className={`mb-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${kind.chip}`}>
                    {kind.label}
                </span>
            ) : (
                // 종류 지정 카드 — 배지를 누르면 종류 트레이가 열려 변경/해제(트랙 D 피드백).
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setTrayOpen((o) => !o);
                    }}
                    className={`nodrag mb-1 inline-block cursor-pointer rounded-full px-1.5 py-0.5 text-[10px] font-medium hover:brightness-95 ${kind.chip}`}
                    title="종류 바꾸기"
                >
                    {kind.label}
                </button>
            )}

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

            {/* 종류 선택 칩 트레이(트랙 D, C안) — 카드 우측에 세로로(우측 핸들 바깥 ml-4). 무지정은 자동, 종류 지정은 배지로 연 경우만. */}
            {selected && !editing && (isUntyped || trayOpen) && (
                <div className="nodrag nopan absolute top-0 left-full ml-4 flex w-24 flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                    {CARD_KINDS.map((k) => {
                        const on = kind.id === k.id;
                        return (
                            <button
                                key={k.id}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 같은 칩 재탭 = 무지정 해제(null), 아니면 그 종류로 부여. 변경 후 트레이 닫음.
                                    setCardKind(Number(id), on ? null : k.id);
                                    setTrayOpen(false);
                                }}
                                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs font-medium transition-colors ${
                                    on ? `${k.chip} border-transparent` : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                <span className={`h-2 w-2 rounded-full ${k.dot}`} aria-hidden="true" />
                                {k.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 카드 바깥 하단 인디케이터(선택 시) — 잇기 진입 + 삭제. */}
            {selected && !editing && (
                <div className="nodrag nopan absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            startConnect(Number(id));
                        }}
                        className="rounded-full border border-dashed border-terracotta-400/50 bg-white/60 px-3 py-1 text-[11px] font-semibold text-terracotta-600 shadow-sm backdrop-blur-sm hover:bg-white/90 hover:text-terracotta-700"
                    >
                        ↗ 연결할 카드 고르기
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void deleteElements({ nodes: [{ id }] });
                        }}
                        className="rounded-full border border-dashed border-gray-300 bg-white/60 px-3 py-1 text-[11px] font-semibold text-gray-500 shadow-sm backdrop-blur-sm hover:border-red-300 hover:bg-white/90 hover:text-red-600"
                    >
                        ✕ 삭제
                    </button>
                </div>
            )}
        </div>
    );
}
