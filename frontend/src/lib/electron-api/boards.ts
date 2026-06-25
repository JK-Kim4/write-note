/**
 * webElectronApi.boards (038) — 플롯 보드/카드/연결/매핑. lib/api/boards 어댑터에 위임.
 */
import {
    batchCardPositions,
    createBoard,
    createCard,
    createLink,
    deleteBoard,
    deleteCard,
    deleteLink,
    getBoard,
    listBoards,
    renameBoard,
    setBoardCategory,
    setBoardProject,
    updateCard,
    updateViewport,
} from "@/lib/api/boards";
import type {
    BoardDetail,
    BoardListFilter,
    BoardResponse,
    BoardSummary,
    BoardViewport,
    CardPositionItem,
    CardResponse,
    CreateBoardInput,
    CreateCardInput,
    LinkResponse,
    UpdateCardInput,
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
    createCard: (boardId: number, input: CreateCardInput): Promise<CardResponse> =>
        createCard(boardId, input),
    updateCard: (boardId: number, cardId: number, input: UpdateCardInput): Promise<CardResponse> =>
        updateCard(boardId, cardId, input),
    batchCardPositions: (boardId: number, items: CardPositionItem[]): Promise<CardResponse[]> =>
        batchCardPositions(boardId, items),
    deleteCard: (boardId: number, cardId: number): Promise<void> => deleteCard(boardId, cardId),
    createLink: (
        boardId: number,
        sourceCardId: number,
        targetCardId: number,
        sourceHandle?: string | null,
        targetHandle?: string | null,
    ): Promise<LinkResponse> => createLink(boardId, sourceCardId, targetCardId, sourceHandle, targetHandle),
    deleteLink: (boardId: number, linkId: number): Promise<void> => deleteLink(boardId, linkId),
};
