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
};

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
    const ctx = useContext(BoardActionsContext);
    if (!ctx) {
        throw new Error("useBoardActions must be used within BoardActionsContext provider");
    }
    return ctx;
}
