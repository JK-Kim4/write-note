import { apiFetch } from "./client";

/**
 * 카드 관리(048) HTTP 클라이언트 — `/api/cards`(유저 스코프). 보드 캔버스 카드(`lib/api/boards`)와 별개:
 * 여러 보드를 가로지르는 목록 + 보드 없는 독립 카드. 재배정/대상 보드 오류(400 BOARD_OWNER_INVALID)는
 * client.ts 의 generic 경로가 `error.code` 를 `ApiError.code` 로 전달 — 호출부는 `err.code` 로 분기.
 */

/** 카드 관리 항목. boardId/boardName=소속(null=독립 → "속한 보드 없음"). linkCount=연결된 다른 카드 수(distinct). */
export interface CardItem {
    id: number;
    boardId: number | null;
    boardName: string | null;
    /** 소속 보드의 대상 — "project"=작품, "category"=시리즈, null=아이디어 보드(또는 독립 카드). */
    ownerType: string | null;
    /** 작품명/시리즈명/"아이디어". 독립 카드는 null. */
    ownerLabel: string | null;
    body: string;
    /** 역할 종류(character/place/event/theme). null=무지정 */
    type: string | null;
    linkCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateStandaloneCardInput {
    body?: string;
}

export interface EditCardInput {
    body?: string;
    /** null=무지정으로 해제. 값은 4종. */
    type?: string | null;
}

/** 본인 카드 전량(보드 소속 + 독립), 생성일 내림차순. 검색·필터는 호출부 클라 필터. */
export function listCards(): Promise<CardItem[]> {
    return apiFetch<CardItem[]>("/api/cards", { method: "GET" });
}

/** 독립 카드 생성(board_id=null). body 미지정 시 빈 본문(FE 가 내용 필수 가드). 종류는 생성 후 상세에서 부여. */
export function createStandaloneCard(input: CreateStandaloneCardInput): Promise<CardItem> {
    return apiFetch<CardItem>("/api/cards", {
        method: "POST",
        body: JSON.stringify({ body: input.body ?? "" }),
    });
}

/** 본문/종류 수정 — type=null 이면 무지정으로 해제. */
export function editCard(cardId: number, input: EditCardInput): Promise<CardItem> {
    return apiFetch<CardItem>(`/api/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: input.body, type: input.type ?? null }),
    });
}

export function deleteCard(cardId: number): Promise<void> {
    return apiFetch<void>(`/api/cards/${cardId}`, { method: "DELETE" });
}

/** 소속 보드 변경 — boardId=본인 보드 배정, null=독립으로 떼기. 연결 있는 카드는 400(호출부가 선제 차단). */
export function setCardBoard(cardId: number, boardId: number | null): Promise<CardItem> {
    return apiFetch<CardItem>(`/api/cards/${cardId}/board`, {
        method: "PATCH",
        body: JSON.stringify({ boardId }),
    });
}
