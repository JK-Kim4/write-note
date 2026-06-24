"use client";

import { createContext, useContext } from "react";

/**
 * 캔버스 → 커스텀 노드(NodeCard) 로 전달되는 액션. 함수를 node.data 에 넣으면 매 변경마다
 * 노드가 리렌더되므로, 컨텍스트로 분리해 안정적으로 전달한다.
 */
export type BoardActions = {
    /** 노드 본문 편집 커밋(영속 + RF 상태 갱신). 캔버스가 구현. */
    editNodeBody: (nodeId: number, body: string) => void;
};

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
    const ctx = useContext(BoardActionsContext);
    if (!ctx) {
        throw new Error("useBoardActions must be used within BoardActionsContext provider");
    }
    return ctx;
}
