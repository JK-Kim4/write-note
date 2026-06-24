"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import {
    Background,
    Controls,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    useReactFlow,
    type Node,
    type NodeTypes,
    type OnNodeDrag,
    type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    boardKeys,
    useBatchNodePositions,
    useCreateNode,
    useDeleteNode,
    useUpdateNode,
    useUpdateViewport,
} from "@/lib/query/useBoards";
import type { BoardDetail, BoardNodeResponse } from "@/lib/api/boards";
import { NodeCard, type PlotNodeData } from "./NodeCard";
import { BoardActionsContext } from "./boardActions";
import { DEFAULT_KIND, NODE_KINDS } from "./nodeKinds";

/**
 * 플롯 보드 캔버스(038) — React Flow v12. 노드 생성/편집/드래그 배치·뷰포트를 영속한다.
 *
 * 낙관 반영 = RF 로컬 상태(드래그 즉시 반영), 영속은 mutation. 위치 저장은 드래그 종료(onNodeDragStop)
 * 에서만(FR-008), 뷰포트는 onMoveEnd 디바운스(FR-012). 실패 시 직전 상태로 복원하고 알린다(FR-014).
 * 클라이언트 전용(dynamic ssr:false 로 로드).
 *
 * 연결(엣지) UI 는 현재 보류 — 연결점/엣지 그리기 미노출(추후 논의). 백엔드 엣지 계약·데이터는 보존.
 */

const nodeTypes: NodeTypes = { plot: NodeCard };

const toRFNode = (n: BoardNodeResponse): Node<PlotNodeData> => ({
    id: String(n.id),
    type: "plot",
    position: { x: n.posX, y: n.posY },
    data: { body: n.body, kind: n.type },
    zIndex: n.zIndex,
});

const isTemp = (id: string): boolean => id.startsWith("temp-");

function CanvasInner({ boardId, detail }: { boardId: number; detail: BoardDetail }) {
    const qc = useQueryClient();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<PlotNodeData>>(detail.nodes.map(toRFNode));
    const [error, setError] = useState<string | null>(null);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const { screenToFlowPosition } = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tempCounter = useRef(0);
    const dragSnapshot = useRef<Map<string, { x: number; y: number }>>(new Map());
    const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingViewport = useRef<Viewport | null>(null);

    const createNode = useCreateNode(boardId);
    const updateNode = useUpdateNode(boardId);
    const batchPositions = useBatchNodePositions(boardId);
    const deleteNodeMut = useDeleteNode(boardId);
    const updateViewport = useUpdateViewport(boardId);

    // detail 변경(초기 하이드레이션 + 에러 후 무효화 refetch) 시 RF 상태 재시드 → 낙관 실패를 서버 진실로 화해.
    useEffect(() => {
        setNodes(detail.nodes.map(toRFNode));
    }, [detail, setNodes]);

    // 이탈 시 미저장 뷰포트(디바운스 대기 중)를 best-effort flush — 마지막 화면 상태 100% 복원(SC-001).
    useEffect(
        () => () => {
            if (viewportTimer.current) {
                clearTimeout(viewportTimer.current);
                const pending = pendingViewport.current;
                if (pending) {
                    void webElectronApi.boards.updateViewport(boardId, {
                        zoom: pending.zoom,
                        x: pending.x,
                        y: pending.y,
                    });
                }
            }
        },
        [boardId],
    );

    const reseedFromServer = useCallback(() => {
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    }, [qc, boardId]);

    const editNodeBody = useCallback(
        (nodeId: number, body: string) => {
            setNodes((nds) =>
                nds.map((n) => (n.id === String(nodeId) ? { ...n, data: { ...n.data, body } } : n)),
            );
            updateNode.mutate(
                { nodeId, input: { body } },
                {
                    onError: () => {
                        setError("본문 저장에 실패했습니다.");
                        reseedFromServer();
                    },
                },
            );
        },
        [setNodes, updateNode, reseedFromServer],
    );

    const boardActions = useMemo(() => ({ editNodeBody }), [editNodeBody]);

    const handleAddNode = useCallback(
        (kind: string = DEFAULT_KIND) => {
            setAddMenuOpen(false);
            const rect = wrapperRef.current?.getBoundingClientRect();
            const screen = rect
                ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                : { x: 200, y: 200 };
            const position = screenToFlowPosition(screen);
            const tempId = `temp-${++tempCounter.current}`;
            const optimistic: Node<PlotNodeData> = {
                id: tempId,
                type: "plot",
                position,
                data: { body: "", kind },
            };
            setNodes((nds) => [...nds, optimistic]);
            createNode.mutate(
                { body: "", posX: position.x, posY: position.y, type: kind },
                {
                    onSuccess: (node) =>
                        setNodes((nds) => nds.map((n) => (n.id === tempId ? { ...n, id: String(node.id) } : n))),
                    onError: () => {
                        setNodes((nds) => nds.filter((n) => n.id !== tempId));
                        setError("노드 생성에 실패했습니다.");
                    },
                },
            );
        },
        [screenToFlowPosition, setNodes, createNode],
    );

    const handleNodeDragStart: OnNodeDrag<Node<PlotNodeData>> = useCallback((_e, _node, dragged) => {
        dragSnapshot.current = new Map(dragged.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));
    }, []);

    const handleNodeDragStop: OnNodeDrag<Node<PlotNodeData>> = useCallback(
        (_e, _node, dragged) => {
            const persistable = dragged.filter((n) => !isTemp(n.id));
            if (persistable.length === 0) return;
            const items = persistable.map((n) => ({
                id: Number(n.id),
                posX: n.position.x,
                posY: n.position.y,
            }));
            const snapshot = dragSnapshot.current;
            batchPositions.mutate(items, {
                onError: () => {
                    setError("위치 저장에 실패했습니다.");
                    setNodes((nds) =>
                        nds.map((n) => {
                            const prev = snapshot.get(n.id);
                            return prev ? { ...n, position: prev } : n;
                        }),
                    );
                },
            });
        },
        [batchPositions, setNodes],
    );

    const handleNodesDelete = useCallback(
        (deleted: Node[]) => {
            deleted
                .filter((n) => !isTemp(n.id))
                .forEach((n) =>
                    deleteNodeMut.mutate(Number(n.id), {
                        onError: () => {
                            setError("노드 삭제에 실패했습니다.");
                            reseedFromServer();
                        },
                    }),
                );
        },
        [deleteNodeMut, reseedFromServer],
    );

    const handleMoveEnd = useCallback(
        (_e: MouseEvent | TouchEvent | null, viewport: Viewport) => {
            if (viewportTimer.current) clearTimeout(viewportTimer.current);
            pendingViewport.current = viewport;
            viewportTimer.current = setTimeout(() => {
                updateViewport.mutate({ zoom: viewport.zoom, x: viewport.x, y: viewport.y });
                pendingViewport.current = null;
            }, 600);
        },
        [updateViewport],
    );

    return (
        <BoardActionsContext.Provider value={boardActions}>
            <div ref={wrapperRef} className="h-[calc(100vh-9rem)] w-full rounded-xl border border-gray-200 bg-white">
                <ReactFlow
                    nodes={nodes}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragStop={handleNodeDragStop}
                    onNodesDelete={handleNodesDelete}
                    onMoveEnd={handleMoveEnd}
                    nodesConnectable={false}
                    defaultViewport={{
                        x: detail.board.viewport.x,
                        y: detail.board.viewport.y,
                        zoom: detail.board.viewport.zoom,
                    }}
                    onlyRenderVisibleElements
                    colorMode="light"
                    minZoom={0.2}
                    maxZoom={2}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background />
                    <Controls />
                    <Panel position="top-left">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setAddMenuOpen((o) => !o)}
                                aria-expanded={addMenuOpen}
                                className="rounded-md border border-gray-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-gray-50"
                            >
                                + 노드
                            </button>
                            {addMenuOpen && (
                                <div className="absolute left-0 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                    {NODE_KINDS.map((k) => (
                                        <button
                                            key={k.id}
                                            type="button"
                                            onClick={() => handleAddNode(k.id)}
                                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            <span className={`h-2.5 w-2.5 rounded-full ${k.dot}`} aria-hidden="true" />
                                            {k.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Panel>
                    {error && (
                        <Panel position="bottom-center">
                            <div
                                role="alert"
                                className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 shadow"
                            >
                                <span aria-hidden="true">⚠</span>
                                {error}
                                <button
                                    type="button"
                                    aria-label="닫기"
                                    onClick={() => setError(null)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    ×
                                </button>
                            </div>
                        </Panel>
                    )}
                </ReactFlow>
            </div>
        </BoardActionsContext.Provider>
    );
}

export default function PlotBoardCanvas({ boardId, detail }: { boardId: number; detail: BoardDetail }) {
    return (
        <ReactFlowProvider>
            <CanvasInner boardId={boardId} detail={detail} />
        </ReactFlowProvider>
    );
}
