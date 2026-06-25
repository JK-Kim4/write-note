/**
 * webElectronApi.boards (038) — 플롯 보드/노드/엣지/매핑. lib/api/boards 어댑터에 위임.
 */
import {
    batchNodePositions,
    createBoard,
    createEdge,
    createNode,
    deleteBoard,
    deleteEdge,
    deleteNode,
    getBoard,
    listBoards,
    renameBoard,
    setBoardCategory,
    setBoardProject,
    updateNode,
    updateViewport,
} from "@/lib/api/boards";
import type {
    BoardDetail,
    BoardEdgeResponse,
    BoardListFilter,
    BoardNodeResponse,
    BoardResponse,
    BoardSummary,
    BoardViewport,
    CreateBoardInput,
    CreateNodeInput,
    NodePositionItem,
    UpdateNodeInput,
} from "@/lib/api/boards";

export const boards = {
    list: (filter?: BoardListFilter): Promise<BoardSummary[]> => listBoards(filter),
    get: (boardId: number): Promise<BoardDetail> => getBoard(boardId),
    create: (input: CreateBoardInput): Promise<BoardResponse> => createBoard(input),
    rename: (boardId: number, name: string): Promise<BoardResponse> => renameBoard(boardId, name),
    delete: (boardId: number): Promise<void> => deleteBoard(boardId),
    setProject: (boardId: number, projectId: number | null): Promise<BoardResponse> =>
        setBoardProject(boardId, projectId),
    setCategory: (boardId: number, categoryId: number | null): Promise<BoardResponse> =>
        setBoardCategory(boardId, categoryId),
    updateViewport: (boardId: number, viewport: BoardViewport): Promise<BoardResponse> =>
        updateViewport(boardId, viewport),
    createNode: (boardId: number, input: CreateNodeInput): Promise<BoardNodeResponse> =>
        createNode(boardId, input),
    updateNode: (boardId: number, nodeId: number, input: UpdateNodeInput): Promise<BoardNodeResponse> =>
        updateNode(boardId, nodeId, input),
    batchNodePositions: (boardId: number, items: NodePositionItem[]): Promise<BoardNodeResponse[]> =>
        batchNodePositions(boardId, items),
    deleteNode: (boardId: number, nodeId: number): Promise<void> => deleteNode(boardId, nodeId),
    createEdge: (
        boardId: number,
        sourceNodeId: number,
        targetNodeId: number,
        sourceHandle?: string | null,
        targetHandle?: string | null,
    ): Promise<BoardEdgeResponse> => createEdge(boardId, sourceNodeId, targetNodeId, sourceHandle, targetHandle),
    deleteEdge: (boardId: number, edgeId: number): Promise<void> => deleteEdge(boardId, edgeId),
};
