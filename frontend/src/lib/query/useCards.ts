"use client";

/**
 * 카드 관리(048) React Query 훅. 키 컨벤션은 boards 훅과 동형.
 *
 * 재배정/떼기/삭제는 소속 보드가 바뀌므로 boards 캐시(`boardKeys.all` — useBoardDetail·useBoardsMine)도
 * 무효화해 캔버스·허브가 stale 되지 않게 한다(advisor blind-spot). 목록·검색·필터는 호출부 클라 처리.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { boardKeys } from "./useBoards";
import type { CreateStandaloneCardInput, EditCardInput } from "@/lib/api/cards";

export const cardKeys = {
    all: ["cards"] as const,
    list: () => [...cardKeys.all, "list"] as const,
};

/** 카드 관리 목록(US1) — 본인 카드 전량, 생성일 내림차순. 상세는 목록 항목을 그대로 재사용(별도 fetch 없음). */
export function useCardList() {
    return useQuery({
        queryKey: cardKeys.list(),
        queryFn: () => webElectronApi.cards.list(),
        refetchOnMount: "always",
    });
}

/** 독립 카드 생성(US2) — 성공 시 목록 무효화. */
export function useCreateStandaloneCard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateStandaloneCardInput) => webElectronApi.cards.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: cardKeys.all }),
    });
}

/** 본문/종류 수정(US3). */
export function useEditCard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ cardId, input }: { cardId: number; input: EditCardInput }) =>
            webElectronApi.cards.edit(cardId, input),
        onSuccess: () => qc.invalidateQueries({ queryKey: cardKeys.all }),
    });
}

/** 삭제(US4) — 링크 cascade 로 보드도 바뀌므로 boards 캐시도 무효화. */
export function useDeleteCard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (cardId: number) => webElectronApi.cards.delete(cardId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: cardKeys.all });
            qc.invalidateQueries({ queryKey: boardKeys.all });
        },
    });
}

/** 소속 보드 변경(US5) — 캔버스·허브 stale 방지로 boards 캐시도 무효화. */
export function useSetCardBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ cardId, boardId }: { cardId: number; boardId: number | null }) =>
            webElectronApi.cards.setBoard(cardId, boardId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: cardKeys.all });
            qc.invalidateQueries({ queryKey: boardKeys.all });
        },
    });
}
