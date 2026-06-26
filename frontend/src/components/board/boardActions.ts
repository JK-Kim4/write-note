"use client";

import { createContext, useContext } from "react";

/**
 * 캔버스 → 커스텀 노드(CardNode) 로 전달되는 액션. 함수를 node.data 에 넣으면 매 변경마다
 * 노드가 리렌더되므로, 컨텍스트로 분리해 안정적으로 전달한다.
 */
export type BoardActions = {
    /** 카드 본문 편집 커밋(영속 + RF 상태 갱신). 캔버스가 구현. */
    editCardBody: (cardId: number, body: string) => void;
    /** 클릭-클릭 잇기 모드 시작(이 카드를 출발점으로). 캔버스가 구현. */
    startConnect: (cardId: number) => void;
    /** 카드 종류 설정/해제(트랙 D). kind=null 이면 무지정 해제. 낙관적 + 실패 시 롤백. 캔버스가 구현. */
    setCardKind: (cardId: number, kind: string | null) => void;
    /** 생성 직후 자동 본문 편집을 열 대상 카드 id(044). null=없음. 실제 id 확정 후 캔버스가 set. */
    autoEditCardId: string | null;
    /** 자동 편집을 연 카드가 소비(1회성) — 캔버스의 autoEditCardId 를 null 로. 캔버스가 구현. */
    consumeAutoEdit: (cardId: number) => void;
};

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
    const ctx = useContext(BoardActionsContext);
    if (!ctx) {
        throw new Error("useBoardActions must be used within BoardActionsContext provider");
    }
    return ctx;
}
