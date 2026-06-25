import { apiFetch } from "./client";

/**
 * 플롯 보드(038) HTTP 클라이언트 — `/api/boards`.
 *
 * 노드/엣지는 보드 전용 객체(캡처 메모와 별개). 매핑(projectId·categoryId)은 0~1.
 * 보드 에러(409 BOARD_*_ALREADY_MAPPED / BOARD_EDGE_DUPLICATE, 400 BOARD_EDGE_INVALID)는
 * client.ts 의 generic 경로가 `error.code` 를 `ApiError.code` 로 전달 — 호출부는 `err.code` 로 분기.
 */

export interface BoardViewport {
    zoom: number;
    x: number;
    y: number;
}

export interface BoardSummary {
    id: number;
    name: string;
    projectId: number | null;
    categoryId: number | null;
    nodeCount: number;
    updatedAt: string;
}

export interface BoardResponse {
    id: number;
    name: string;
    projectId: number | null;
    categoryId: number | null;
    viewport: BoardViewport;
    createdAt: string;
    updatedAt: string;
}

export interface BoardNodeResponse {
    id: number;
    body: string;
    /** 역할 타입(plot/character/place/theme/note, V25) */
    type: string;
    posX: number;
    posY: number;
    zIndex: number;
    updatedAt: string;
}

export interface BoardEdgeResponse {
    id: number;
    sourceNodeId: number;
    targetNodeId: number;
    /** 연결 테두리 앵커(top/right/bottom/left 또는 null). 039 트랙 A — 사용자가 고른 테두리 영속. */
    sourceHandle: string | null;
    targetHandle: string | null;
}

export interface BoardDetail {
    board: BoardResponse;
    nodes: BoardNodeResponse[];
    edges: BoardEdgeResponse[];
}

export interface BoardListFilter {
    projectId?: number;
    categoryId?: number;
    unmapped?: boolean;
}

export interface CreateBoardInput {
    name: string;
    projectId?: number | null;
    categoryId?: number | null;
}

export interface CreateNodeInput {
    body?: string;
    posX: number;
    posY: number;
    zIndex?: number;
    type?: string;
}

export interface UpdateNodeInput {
    body?: string;
    posX?: number;
    posY?: number;
    zIndex?: number;
    type?: string;
}

export interface NodePositionItem {
    id: number;
    posX: number;
    posY: number;
    zIndex?: number;
}

export function listBoards(filter?: BoardListFilter): Promise<BoardSummary[]> {
    const qs = new URLSearchParams();
    if (filter?.projectId != null) qs.set("projectId", String(filter.projectId));
    if (filter?.categoryId != null) qs.set("categoryId", String(filter.categoryId));
    if (filter?.unmapped) qs.set("unmapped", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<BoardSummary[]>(`/api/boards${suffix}`, { method: "GET" });
}

export function getBoard(boardId: number): Promise<BoardDetail> {
    return apiFetch<BoardDetail>(`/api/boards/${boardId}`, { method: "GET" });
}

export function createBoard(input: CreateBoardInput): Promise<BoardResponse> {
    return apiFetch<BoardResponse>("/api/boards", { method: "POST", body: JSON.stringify(input) });
}

export function renameBoard(boardId: number, name: string): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
    });
}

export function deleteBoard(boardId: number): Promise<void> {
    return apiFetch<void>(`/api/boards/${boardId}`, { method: "DELETE" });
}

export function setBoardProject(boardId: number, projectId: number | null): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}/project`, {
        method: "PUT",
        body: JSON.stringify({ projectId }),
    });
}

export function setBoardCategory(boardId: number, categoryId: number | null): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}/category`, {
        method: "PUT",
        body: JSON.stringify({ categoryId }),
    });
}

export function updateViewport(boardId: number, viewport: BoardViewport): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}/viewport`, {
        method: "PATCH",
        body: JSON.stringify(viewport),
    });
}

export function createNode(boardId: number, input: CreateNodeInput): Promise<BoardNodeResponse> {
    return apiFetch<BoardNodeResponse>(`/api/boards/${boardId}/nodes`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function updateNode(
    boardId: number,
    nodeId: number,
    input: UpdateNodeInput,
): Promise<BoardNodeResponse> {
    return apiFetch<BoardNodeResponse>(`/api/boards/${boardId}/nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function batchNodePositions(
    boardId: number,
    items: NodePositionItem[],
): Promise<BoardNodeResponse[]> {
    return apiFetch<BoardNodeResponse[]>(`/api/boards/${boardId}/nodes`, {
        method: "PATCH",
        body: JSON.stringify(items),
    });
}

export function deleteNode(boardId: number, nodeId: number): Promise<void> {
    return apiFetch<void>(`/api/boards/${boardId}/nodes/${nodeId}`, { method: "DELETE" });
}

export function createEdge(
    boardId: number,
    sourceNodeId: number,
    targetNodeId: number,
    sourceHandle?: string | null,
    targetHandle?: string | null,
): Promise<BoardEdgeResponse> {
    return apiFetch<BoardEdgeResponse>(`/api/boards/${boardId}/edges`, {
        method: "POST",
        body: JSON.stringify({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }),
    });
}

export function deleteEdge(boardId: number, edgeId: number): Promise<void> {
    return apiFetch<void>(`/api/boards/${boardId}/edges/${edgeId}`, { method: "DELETE" });
}
