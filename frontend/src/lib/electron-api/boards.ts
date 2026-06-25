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
    listMyBoards,
    renameBoard,
    setBoardOwner,
    updateCard,
    updateCardType,
    updateViewport,
} from "@/lib/api/boards";
import type {
    BoardDetail,
    BoardListFilter,
    BoardOwnerType,
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
    mine: (): Promise<BoardSummary[]> => listMyBoards(),
    list: (filter?: BoardListFilter): Promise<BoardSummary[]> => listBoards(filter),
    get: (boardId: number): Promise<BoardDetail> => getBoard(boardId),
    create: (input: CreateBoardInput): Promise<BoardResponse> => createBoard(input),
    rename: (boardId: number, name: string): Promise<BoardResponse> => renameBoard(boardId, name),
    delete: (boardId: number): Promise<void> => deleteBoard(boardId),
    setOwner: (boardId: number, ownerType: BoardOwnerType | null, ownerId: number | null): Promise<BoardResponse> =>
        setBoardOwner(boardId, ownerType, ownerId),
    updateViewport: (boardId: number, viewport: BoardViewport): Promise<BoardResponse> =>
        updateViewport(boardId, viewport),
    createCard: (boardId: number, input: CreateCardInput): Promise<CardResponse> =>
        createCard(boardId, input),
    updateCard: (boardId: number, cardId: number, input: UpdateCardInput): Promise<CardResponse> =>
        updateCard(boardId, cardId, input),
    updateCardType: (boardId: number, cardId: number, type: string | null): Promise<CardResponse> =>
        updateCardType(boardId, cardId, type),
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
