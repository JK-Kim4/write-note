"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import {
    Background,
    ConnectionMode,
    Controls,
    MiniMap,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
    useReactFlow,
    type Edge,
    type IsValidConnection,
    type Node,
    type NodeMouseHandler,
    type NodeTypes,
    type EdgeTypes,
    type OnConnect,
    type OnConnectEnd,
    type OnNodeDrag,
    type Viewport,
    type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    boardKeys,
    useBatchCardPositions,
    useCreateCard,
    useCreateLink,
    useDeleteCard,
    useDeleteLink,
    useSetCardType,
    useUpdateCard,
    useUpdateViewport,
} from "@/lib/query/useBoards";
import type { BoardDetail, CardResponse } from "@/lib/api/boards";
import { CardNode, type CardNodeData } from "./CardNode";
import { LinkEdge } from "./LinkEdge";
import { BoardActionsContext } from "./boardActions";
import { BoardEmptyGuide } from "./BoardEmptyGuide";
import { isNotFoundError, isPaneHit } from "./boardCanvasHelpers";
import { canLink, incidentLinkIds, nearestHandlePair, neighborCardIds, toRFEdge } from "./linkGraph";

/**
 * 플롯 보드 캔버스(038/039) — React Flow v12. 카드 생성/편집/드래그 배치·뷰포트·연결(Link)을 영속한다.
 *
 * 낙관 반영 = RF 로컬 상태(드래그/연결 즉시 반영), 영속은 mutation. 위치 저장은 드래그 종료(onNodeDragStop)
 * 에서만(FR-008), 뷰포트는 onMoveEnd 디바운스(FR-012). 실패 시 직전 상태로 복원하고 알린다(FR-014).
 * 클라이언트 전용(dynamic ssr:false 로 로드).
 *
 * 연결(039 트랙 A): 무방향 선(ConnectionMode.Loose, 화살표 없음). 드래그 유효 drop(onConnect)·빈 곳
 * drop(onConnectEnd→새 카드+연결)·클릭-클릭(잇기 버튼) 4경로. 이미 이어진 쌍(양방향)·자기연결은
 * linkGraph.canLink 로 선제 차단. 끊기=LinkEdge hover ✕(+Delete). 이웃 하이라이트=선택 카드 기준 dim.
 * 어댑터 경계: React Flow 의 node/edge 용어는 본 파일·LinkEdge·CardNode·linkGraph 내부만.
 */

const nodeTypes: NodeTypes = { plot: CardNode };
const edgeTypes: EdgeTypes = { link: LinkEdge };

const toRFNode = (c: CardResponse): Node<CardNodeData> => ({
    id: String(c.id),
    type: "plot",
    position: { x: c.posX, y: c.posY },
    data: { body: c.body, kind: c.type },
    zIndex: c.zIndex,
});

const isTemp = (id: string): boolean => id.startsWith("temp-");
const isTempLink = (id: string): boolean => id.startsWith("temp-link");

// 카드 중심(캔버스 좌표) — 클릭-클릭 연결의 마주보는 핸들 계산용. 폭 고정(w-48=192), 높이는 measured(가변) 우선.
const NOMINAL_CARD = { width: 192, height: 80 };
const cardCenter = (n: { position: XYPosition; measured?: { width?: number; height?: number } }): XYPosition => ({
    x: n.position.x + (n.measured?.width ?? NOMINAL_CARD.width) / 2,
    y: n.position.y + (n.measured?.height ?? NOMINAL_CARD.height) / 2,
});

function CanvasInner({ boardId, detail }: { boardId: number; detail: BoardDetail }) {
    const qc = useQueryClient();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<CardNodeData>>(detail.cards.map(toRFNode));
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(detail.links.map(toRFEdge));
    const [error, setError] = useState<string | null>(null);
    const [showMinimap, setShowMinimap] = useState(false);
    const [connectFromId, setConnectFromId] = useState<string | null>(null);
    const [pendingEmptyDrop, setPendingEmptyDrop] = useState<{
        fromId: string;
        fromHandle?: string;
        pos: XYPosition;
    } | null>(null);
    // 생성 직후 자동 본문 편집을 열 대상(044) — 실제 id 확정(onSuccess) 후 set, CardNode 가 소비.
    const [autoEditCardId, setAutoEditCardId] = useState<string | null>(null);
    const { screenToFlowPosition, getNode, fitView } = useReactFlow();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tempCounter = useRef(0);
    const tempLinkCounter = useRef(0);
    const dragSnapshot = useRef<Map<string, { x: number; y: number }>>(new Map());
    const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingViewport = useRef<Viewport | null>(null);

    const createCard = useCreateCard(boardId);
    const updateCard = useUpdateCard(boardId);
    const setCardTypeMut = useSetCardType(boardId);
    const batchPositions = useBatchCardPositions(boardId);
    const deleteCardMut = useDeleteCard(boardId);
    const updateViewport = useUpdateViewport(boardId);
    const createLinkMut = useCreateLink(boardId);
    const deleteLinkMut = useDeleteLink(boardId);

    // detail 변경(초기 하이드레이션 + 에러 후 무효화 refetch) 시 RF 상태 재시드 → 낙관 실패를 서버 진실로 화해.
    useEffect(() => {
        setNodes(detail.cards.map(toRFNode));
        setEdges(detail.links.map(toRFEdge));
    }, [detail, setNodes, setEdges]);

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

    // ESC = 진행 중 잇기 모드 / 빈 곳 drop 확인 취소.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setConnectFromId(null);
                setPendingEmptyDrop(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const reseedFromServer = useCallback(() => {
        qc.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    }, [qc, boardId]);

    const editCardBody = useCallback(
        (cardId: number, body: string) => {
            setNodes((nds) =>
                nds.map((n) => (n.id === String(cardId) ? { ...n, data: { ...n.data, body } } : n)),
            );
            updateCard.mutate(
                { cardId, input: { body } },
                {
                    onError: () => {
                        setError("본문 저장에 실패했습니다.");
                        reseedFromServer();
                    },
                },
            );
        },
        [setNodes, updateCard, reseedFromServer],
    );

    // 종류 설정/해제(트랙 D) — 낙관적으로 노드 data.kind 즉시 반영, 실패 시 서버 진실로 reseed.
    const setCardKind = useCallback(
        (cardId: number, kind: string | null) => {
            setNodes((nds) =>
                nds.map((n) => (n.id === String(cardId) ? { ...n, data: { ...n.data, kind } } : n)),
            );
            if (isTemp(String(cardId))) return; // 임시 카드(미영속)는 로컬만
            setCardTypeMut.mutate(
                { cardId, type: kind },
                {
                    onError: () => {
                        setError("종류 변경에 실패했습니다.");
                        reseedFromServer();
                    },
                },
            );
        },
        [setNodes, setCardTypeMut, reseedFromServer],
    );

    // ── 연결(Link) ──────────────────────────────────────────────────────────────

    // 두 카드를 잇는다(낙관 temp link → 성공 시 실제 id 교체 / 실패 시 제거+롤백). 무방향 중복·자기연결 가드.
    // sourceHandle/targetHandle = 사용자가 잡은/놓은 테두리 앵커(드래그). 클릭-클릭·빈곳은 미지정(기본 핸들).
    const connectCards = useCallback(
        (sourceId: string, targetId: string, sourceHandle?: string | null, targetHandle?: string | null) => {
            if (!canLink(edges, sourceId, targetId)) return;
            const tempId = `temp-link-${++tempLinkCounter.current}`;
            setEdges((es) => [
                ...es,
                {
                    id: tempId,
                    source: sourceId,
                    target: targetId,
                    type: "link",
                    sourceHandle: sourceHandle ?? undefined,
                    targetHandle: targetHandle ?? undefined,
                },
            ]);
            createLinkMut.mutate(
                { sourceCardId: Number(sourceId), targetCardId: Number(targetId), sourceHandle, targetHandle },
                {
                    onSuccess: (link) =>
                        setEdges((es) => es.map((e) => (e.id === tempId ? { ...e, id: String(link.id) } : e))),
                    onError: () => {
                        setEdges((es) => es.filter((e) => e.id !== tempId));
                        setError("연결에 실패했습니다.");
                    },
                },
            );
        },
        [edges, setEdges, createLinkMut],
    );

    // 드래그 중 유효성 — 유효 카드만 초록 강조 + 중복/자기연결 차단.
    const isValidConnection: IsValidConnection = useCallback(
        (c) => c.source != null && c.target != null && canLink(edges, c.source, c.target),
        [edges],
    );

    // 유효 카드 위 drop → 연결. 사용자가 잡은(source)·놓은(target, Loose=커서에 가장 가까운) 핸들 앵커 보존.
    const handleConnect: OnConnect = useCallback(
        (c) => {
            if (c.source && c.target) connectCards(c.source, c.target, c.sourceHandle, c.targetHandle);
        },
        [connectCards],
    );

    // 빈 곳 drop(toNode 부재) → "새 카드 만들어 잇기" 확인 모달.
    const handleConnectEnd: OnConnectEnd = useCallback(
        (event, state) => {
            if (state.toNode != null || state.fromNode == null) return;
            const fromId = state.fromNode.id;
            if (isTemp(fromId)) return; // 미저장 출발 카드면 무시(깨진 연결 방지)
            const point =
                "changedTouches" in event && event.changedTouches.length > 0
                    ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
                    : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
            setPendingEmptyDrop({
                fromId,
                fromHandle: state.fromHandle?.id ?? undefined,
                pos: screenToFlowPosition(point),
            });
        },
        [screenToFlowPosition],
    );

    // 빈 곳 drop 확인 → 새 카드(무지정) 생성 후 출발 카드와 연결.
    const handleConfirmEmptyDrop = useCallback(() => {
        const drop = pendingEmptyDrop;
        if (!drop) return;
        setPendingEmptyDrop(null);
        const tempId = `temp-${++tempCounter.current}`;
        const optimistic: Node<CardNodeData> = {
            id: tempId,
            type: "plot",
            position: drop.pos,
            data: { body: "", kind: null },
        };
        setNodes((nds) => [...nds, optimistic]);
        createCard.mutate(
            { body: "", posX: drop.pos.x, posY: drop.pos.y },
            {
                onSuccess: (card) => {
                    const realId = String(card.id);
                    setNodes((nds) => nds.map((n) => (n.id === tempId ? { ...n, id: realId } : n)));
                    connectCards(drop.fromId, realId, drop.fromHandle, undefined);
                },
                onError: () => {
                    setNodes((nds) => nds.filter((n) => n.id !== tempId));
                    setError("카드 생성에 실패했습니다.");
                },
            },
        );
    }, [pendingEmptyDrop, setNodes, createCard, connectCards]);

    // 끊기(hover ✕) — 낙관 제거 + 영속(실패 시 reseed).
    const handleDisconnect = useCallback(
        (linkId: string) => {
            setEdges((es) => es.filter((e) => e.id !== linkId));
            if (isTempLink(linkId)) return;
            deleteLinkMut.mutate(Number(linkId), {
                onError: (err) => {
                    if (isNotFoundError(err)) return; // 이미 끊긴 링크(카드 삭제 cascade 등) = 목표 상태 달성, 무시
                    setError("연결 끊기에 실패했습니다.");
                    reseedFromServer();
                },
            });
        },
        [setEdges, deleteLinkMut, reseedFromServer],
    );

    // Delete 키 끊기(보조) — RF 가 edges 에서 이미 제거. 영속만.
    const handleEdgesDelete = useCallback(
        (deleted: Edge[]) => {
            deleted.forEach((e) => {
                if (isTempLink(e.id)) return;
                deleteLinkMut.mutate(Number(e.id), {
                    onError: (err) => {
                        // 카드 삭제 시 RF 가 연결 엣지의 onEdgesDelete 도 발화 → 백엔드 cascade 로 이미 사라진
                        // 링크를 중복 삭제해 404. 이미 끊긴 상태 = 목표 달성이므로 거짓 에러로 알리지 않는다(044).
                        if (isNotFoundError(err)) return;
                        setError("연결 끊기에 실패했습니다.");
                        reseedFromServer();
                    },
                });
            });
        },
        [deleteLinkMut, reseedFromServer],
    );

    const startConnect = useCallback((cardId: number) => {
        setConnectFromId(String(cardId));
    }, []);

    // 클릭-클릭 잇기: 모드 중이면 대상 카드와 연결, 아니면 RF 선택(이웃 하이라이트는 selected 파생).
    // 드래그와 달리 잡은 핸들이 없으므로, 두 카드 중심으로 마주보는 테두리 핸들 쌍을 계산해 앵커로 넘긴다(V26 영속).
    const handleNodeClick: NodeMouseHandler = useCallback(
        (_e, node) => {
            if (!connectFromId) return;
            if (connectFromId !== node.id) {
                const source = getNode(connectFromId);
                if (source) {
                    const { sourceHandle, targetHandle } = nearestHandlePair(cardCenter(source), cardCenter(node));
                    connectCards(connectFromId, node.id, sourceHandle, targetHandle);
                } else {
                    connectCards(connectFromId, node.id);
                }
            }
            setConnectFromId(null);
        },
        [connectFromId, connectCards, getNode],
    );

    const handlePaneClick = useCallback(() => {
        setConnectFromId(null);
    }, []);

    // 자동 편집 소비(044) — 편집을 연 카드가 호출해 1회성으로 닫는다.
    const consumeAutoEdit = useCallback((cardId: number) => {
        setAutoEditCardId((cur) => (cur === String(cardId) ? null : cur));
    }, []);

    const boardActions = useMemo(
        () => ({ editCardBody, startConnect, setCardKind, autoEditCardId, consumeAutoEdit }),
        [editCardBody, startConnect, setCardKind, autoEditCardId, consumeAutoEdit],
    );

    // 이웃 하이라이트 — 선택 카드 기준. 선택은 RF 자체 selected 를 단일 소스로.
    const selectedId = useMemo(() => nodes.find((n) => n.selected)?.id ?? null, [nodes]);
    const displayNodes = useMemo(() => {
        if (!selectedId) return nodes;
        const neighbors = neighborCardIds(edges, selectedId);
        return nodes.map((n) => ({
            ...n,
            data: { ...n.data, dimmed: !(n.id === selectedId || neighbors.has(n.id)) },
        }));
    }, [nodes, edges, selectedId]);
    const displayEdges = useMemo(() => {
        const incident = selectedId ? incidentLinkIds(edges, selectedId) : null;
        return edges.map((e) => ({
            ...e,
            data: { onDisconnect: handleDisconnect, dimmed: incident ? !incident.has(e.id) : false },
        }));
    }, [edges, selectedId, handleDisconnect]);

    // 카드 생성 공통(044) — 세 경로("+ 카드" 버튼 · 빈 곳 더블클릭 · 빈 보드 안내 버튼)가 공유.
    // 종류는 안 묻고 무지정 빈 카드 생성(트랙 D). 낙관적 temp 노드 → 생성 → onSuccess 에서 실제 id
    // 확정 후 자동 편집 진입(temp→real 스왑 리마운트 키 유실 방지), onError 롤백.
    const createCardAt = useCallback(
        (position: XYPosition) => {
            const tempId = `temp-${++tempCounter.current}`;
            const optimistic: Node<CardNodeData> = {
                id: tempId,
                type: "plot",
                position,
                data: { body: "", kind: null },
            };
            setNodes((nds) => [...nds, optimistic]);
            createCard.mutate(
                { body: "", posX: position.x, posY: position.y },
                {
                    onSuccess: (card) => {
                        const realId = String(card.id);
                        setNodes((nds) => nds.map((n) => (n.id === tempId ? { ...n, id: realId } : n)));
                        setAutoEditCardId(realId);
                    },
                    onError: () => {
                        setNodes((nds) => nds.filter((n) => n.id !== tempId));
                        setError("카드 생성에 실패했습니다.");
                    },
                },
            );
        },
        [setNodes, createCard],
    );

    // + 카드 / 빈 보드 안내 버튼 — 캔버스 중앙에 생성.
    const handleAddCard = useCallback(() => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        const screen = rect
            ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            : { x: 200, y: 200 };
        createCardAt(screenToFlowPosition(screen));
    }, [screenToFlowPosition, createCardAt]);

    // 빈 곳(pane) 더블클릭 → 그 자리에 카드 생성(044). React Flow 12 엔 onPaneDoubleClick 이 없어
    // wrapper 네이티브 더블클릭 + isPaneHit 로 카드/핸들/컨트롤 위 더블클릭을 제외한다(zoomOnDoubleClick=false).
    const handlePaneDoubleClick = useCallback(
        (e: ReactMouseEvent<HTMLDivElement>) => {
            if (!isPaneHit(e.target)) return;
            createCardAt(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        },
        [screenToFlowPosition, createCardAt],
    );

    const handleNodeDragStart: OnNodeDrag<Node<CardNodeData>> = useCallback((_e, _node, dragged) => {
        dragSnapshot.current = new Map(dragged.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));
    }, []);

    const handleNodeDragStop: OnNodeDrag<Node<CardNodeData>> = useCallback(
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
                    deleteCardMut.mutate(Number(n.id), {
                        onError: () => {
                            setError("카드 삭제에 실패했습니다.");
                            reseedFromServer();
                        },
                    }),
                );
        },
        [deleteCardMut, reseedFromServer],
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
            <div
                ref={wrapperRef}
                onDoubleClick={handlePaneDoubleClick}
                className="relative h-[calc(100vh-9rem)] w-full rounded-xl border border-gray-200 bg-white"
            >
                <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDragStop={handleNodeDragStop}
                    onNodesDelete={handleNodesDelete}
                    onEdgesDelete={handleEdgesDelete}
                    onConnect={handleConnect}
                    onConnectEnd={handleConnectEnd}
                    isValidConnection={isValidConnection}
                    onNodeClick={handleNodeClick}
                    onPaneClick={handlePaneClick}
                    onMoveEnd={handleMoveEnd}
                    connectionMode={ConnectionMode.Loose}
                    nodesConnectable
                    defaultViewport={{
                        x: detail.board.viewport.x,
                        y: detail.board.viewport.y,
                        zoom: detail.board.viewport.zoom,
                    }}
                    onlyRenderVisibleElements
                    colorMode="light"
                    minZoom={0.2}
                    maxZoom={2}
                    zoomOnDoubleClick={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background />
                    <Controls />
                    {showMinimap && <MiniMap pannable zoomable className="!bg-white" />}
                    <Panel position="top-left">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleAddCard}
                                className="rounded-md border border-gray-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-gray-50"
                            >
                                + 카드
                            </button>
                            <button
                                type="button"
                                onClick={() => fitView({ duration: 300, padding: 0.2 })}
                                className="rounded-md border border-gray-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-gray-50"
                            >
                                한눈에 보기
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowMinimap((v) => !v)}
                                aria-pressed={showMinimap}
                                className={`rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur ${
                                    showMinimap
                                        ? "border-terracotta-300 bg-terracotta-50 text-terracotta-700"
                                        : "border-gray-300 bg-white/80 text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                미니맵
                            </button>
                        </div>
                    </Panel>
                    {connectFromId && (
                        <Panel position="top-center">
                            <div className="flex items-center gap-2 rounded-md border border-terracotta-200 bg-terracotta-50 px-3 py-2 text-sm text-terracotta-700 shadow">
                                <span>연결할 카드를 클릭하세요</span>
                                <button
                                    type="button"
                                    onClick={() => setConnectFromId(null)}
                                    className="text-terracotta-400 hover:text-terracotta-700"
                                >
                                    취소
                                </button>
                            </div>
                        </Panel>
                    )}
                    {pendingEmptyDrop && (
                        <Panel position="top-center">
                            <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-lg">
                                <span>여기에 새 카드를 만들어 이을까요?</span>
                                <button
                                    type="button"
                                    onClick={handleConfirmEmptyDrop}
                                    className="rounded-md bg-terracotta-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-terracotta-600"
                                >
                                    만들기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPendingEmptyDrop(null)}
                                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    취소
                                </button>
                            </div>
                        </Panel>
                    )}
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
                {nodes.length === 0 && <BoardEmptyGuide onCreate={handleAddCard} />}
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
