import { apiFetch } from "./client";

/**
 * 플롯 보드(038, 041 트랙 C) HTTP 클라이언트 — `/api/boards`.
 *
 * 카드/연결은 보드 전용 객체(캡처 메모와 별개). 소속(ownerType/ownerId)은 다형 단일 — null 짝=아이디어 보드.
 * 보드 에러(409 BOARD_LINK_DUPLICATE, 400 BOARD_LINK_INVALID·BOARD_OWNER_INVALID)는
 * client.ts 의 generic 경로가 `error.code` 를 `ApiError.code` 로 전달 — 호출부는 `err.code` 로 분기.
 */

/** 보드 소속 종류 — "project"=작품, "category"=시리즈. null 짝이면 아이디어 보드. */
export type BoardOwnerType = "project" | "category";

export interface BoardViewport {
    zoom: number;
    x: number;
    y: number;
}

export interface BoardSummary {
    id: number;
    name: string;
    ownerType: BoardOwnerType | null;
    ownerId: number | null;
    /** 소속 라벨 — 작품명/시리즈명/"아이디어"(서버 파생). */
    ownerLabel: string;
    cardCount: number;
    updatedAt: string;
}

export interface BoardResponse {
    id: number;
    name: string;
    ownerType: BoardOwnerType | null;
    ownerId: number | null;
    viewport: BoardViewport;
    createdAt: string;
    updatedAt: string;
}

export interface CardResponse {
    id: number;
    body: string;
    /** 역할 타입(plot/character/place/theme/note, V25) */
    type: string;
    posX: number;
    posY: number;
    zIndex: number;
    updatedAt: string;
}

export interface LinkResponse {
    id: number;
    sourceCardId: number;
    targetCardId: number;
    /** 연결 테두리 앵커(top/right/bottom/left 또는 null). 039 트랙 A — 사용자가 고른 테두리 영속. */
    sourceHandle: string | null;
    targetHandle: string | null;
}

export interface BoardDetail {
    board: BoardResponse;
    cards: CardResponse[];
    links: LinkResponse[];
}

export interface BoardListFilter {
    ownerType?: BoardOwnerType;
    ownerId?: number;
    unmapped?: boolean;
}

export interface CreateBoardInput {
    name: string;
    ownerType?: BoardOwnerType | null;
    ownerId?: number | null;
}

export interface CreateCardInput {
    body?: string;
    posX: number;
    posY: number;
    zIndex?: number;
    type?: string;
}

export interface UpdateCardInput {
    body?: string;
    posX?: number;
    posY?: number;
    zIndex?: number;
    type?: string;
}

export interface CardPositionItem {
    id: number;
    posX: number;
    posY: number;
    zIndex?: number;
}

/** 전역 허브 — 내 모든 보드 + 소속 라벨, 최근순. 검색은 호출부 클라 필터. */
export function listMyBoards(): Promise<BoardSummary[]> {
    return apiFetch<BoardSummary[]>("/api/boards/mine", { method: "GET" });
}

/** 소속 필터 목록(내부 탭 ②용). ownerType+ownerId 또는 unmapped. */
export function listBoards(filter?: BoardListFilter): Promise<BoardSummary[]> {
    const qs = new URLSearchParams();
    if (filter?.ownerType != null) qs.set("ownerType", filter.ownerType);
    if (filter?.ownerId != null) qs.set("ownerId", String(filter.ownerId));
    if (filter?.unmapped) qs.set("unmapped", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<BoardSummary[]>(`/api/boards${suffix}`, { method: "GET" });
}

export function getBoard(boardId: number): Promise<BoardDetail> {
    return apiFetch<BoardDetail>(`/api/boards/${boardId}`, { method: "GET" });
}

export function createBoard(input: CreateBoardInput): Promise<BoardResponse> {
    return apiFetch<BoardResponse>("/api/boards", {
        method: "POST",
        body: JSON.stringify({
            name: input.name,
            ownerType: input.ownerType ?? null,
            ownerId: input.ownerId ?? null,
        }),
    });
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

/** 소속 지정/해제 — ownerType/ownerId(작품·시리즈에 연결) 또는 null 짝(아이디어로 해제). PATCH /{id}/owner. */
export function setBoardOwner(
    boardId: number,
    ownerType: BoardOwnerType | null,
    ownerId: number | null,
): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ ownerType, ownerId }),
    });
}

export function updateViewport(boardId: number, viewport: BoardViewport): Promise<BoardResponse> {
    return apiFetch<BoardResponse>(`/api/boards/${boardId}/viewport`, {
        method: "PATCH",
        body: JSON.stringify(viewport),
    });
}

export function createCard(boardId: number, input: CreateCardInput): Promise<CardResponse> {
    return apiFetch<CardResponse>(`/api/boards/${boardId}/cards`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function updateCard(
    boardId: number,
    cardId: number,
    input: UpdateCardInput,
): Promise<CardResponse> {
    return apiFetch<CardResponse>(`/api/boards/${boardId}/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function batchCardPositions(
    boardId: number,
    items: CardPositionItem[],
): Promise<CardResponse[]> {
    return apiFetch<CardResponse[]>(`/api/boards/${boardId}/cards`, {
        method: "PATCH",
        body: JSON.stringify(items),
    });
}

export function deleteCard(boardId: number, cardId: number): Promise<void> {
    return apiFetch<void>(`/api/boards/${boardId}/cards/${cardId}`, { method: "DELETE" });
}

export function createLink(
    boardId: number,
    sourceCardId: number,
    targetCardId: number,
    sourceHandle?: string | null,
    targetHandle?: string | null,
): Promise<LinkResponse> {
    return apiFetch<LinkResponse>(`/api/boards/${boardId}/links`, {
        method: "POST",
        body: JSON.stringify({ sourceCardId, targetCardId, sourceHandle, targetHandle }),
    });
}

export function deleteLink(boardId: number, linkId: number): Promise<void> {
    return apiFetch<void>(`/api/boards/${boardId}/links/${linkId}`, { method: "DELETE" });
}
