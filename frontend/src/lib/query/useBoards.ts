"use client";

/**
 * 플롯 보드(038) React Query 훅. 키 컨벤션은 categories/projects 훅과 동형.
 *
 * 보드 목록/상세 쿼리 + CRUD·매핑 mutation. 이름 변경은 목록 캐시 낙관적 업데이트(실패 롤백).
 * 캔버스 내 고빈도 상호작용(노드 드래그/본문/엣지)의 낙관적 반영은 PlotBoardCanvas 의 React Flow
 * 로컬 상태가 담당(실패 시 직전 상태 복원) — 본 훅들은 영속 + 목록 nodeCount 무효화만 한다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import type {
    BoardListFilter,
    BoardSummary,
    CreateBoardInput,
    CreateNodeInput,
    NodePositionItem,
    UpdateNodeInput,
} from "@/lib/api/boards";

export const boardKeys = {
    all: ["boards"] as const,
    list: (filter?: BoardListFilter) =>
        filter ? ([...boardKeys.all, "list", filter] as const) : ([...boardKeys.all, "list"] as const),
    detail: (id: number) => [...boardKeys.all, "detail", id] as const,
};

export function useBoardList(filter?: BoardListFilter) {
    return useQuery({
        queryKey: boardKeys.list(filter),
        queryFn: () => webElectronApi.boards.list(filter),
        refetchOnMount: "always",
    });
}

export function useBoardDetail(boardId: number, enabled = true) {
    return useQuery({
        queryKey: boardKeys.detail(boardId),
        queryFn: () => webElectronApi.boards.get(boardId),
        enabled,
        // 보드 진입 시 1회 최신 하이드레이션(캔버스가 이 데이터로 시드). 단 세션 중 우발적 refetch가
        // 캔버스의 진행 중 낙관 상태(미저장 드래그·temp 노드·편집)를 덮지 않도록 reconnect refetch는
        // 비활성하고 staleTime은 전역(60s) 상속한다(window focus는 전역 비활성). detail 재시드는
        // 진입 + 명시적 에러 복구 무효화에서만 일어난다.
        refetchOnMount: "always",
        refetchOnReconnect: false,
    });
}

export function useCreateBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateBoardInput) => webElectronApi.boards.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
    });
}

/** 이름 변경 — 목록 캐시 낙관적 업데이트 + 실패 롤백(FR-014). */
export function useRenameBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) => webElectronApi.boards.rename(id, name),
        onMutate: async ({ id, name }: { id: number; name: string }) => {
            await qc.cancelQueries({ queryKey: boardKeys.list() });
            const previous = qc.getQueryData<BoardSummary[]>(boardKeys.list());
            qc.setQueryData<BoardSummary[]>(boardKeys.list(), (old) =>
                old?.map((b) => (b.id === id ? { ...b, name } : b)),
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                qc.setQueryData(boardKeys.list(), context.previous);
            }
        },
        onSettled: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
    });
}

export function useDeleteBoard() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => webElectronApi.boards.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
    });
}

export function useSetBoardProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, projectId }: { id: number; projectId: number | null }) =>
            webElectronApi.boards.setProject(id, projectId),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
    });
}

export function useSetBoardCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, categoryId }: { id: number; categoryId: number | null }) =>
            webElectronApi.boards.setCategory(id, categoryId),
        onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
    });
}

// ── 캔버스 영속 mutation (낙관 반영은 캔버스 RF 로컬 상태) ──────────────────────

export function useCreateNode(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateNodeInput) => webElectronApi.boards.createNode(boardId, input),
        onSettled: () => qc.invalidateQueries({ queryKey: boardKeys.list() }),
    });
}

export function useUpdateNode(boardId: number) {
    return useMutation({
        mutationFn: ({ nodeId, input }: { nodeId: number; input: UpdateNodeInput }) =>
            webElectronApi.boards.updateNode(boardId, nodeId, input),
    });
}

export function useBatchNodePositions(boardId: number) {
    return useMutation({
        mutationFn: (items: NodePositionItem[]) => webElectronApi.boards.batchNodePositions(boardId, items),
    });
}

export function useDeleteNode(boardId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (nodeId: number) => webElectronApi.boards.deleteNode(boardId, nodeId),
        onSettled: () => qc.invalidateQueries({ queryKey: boardKeys.list() }),
    });
}

export function useUpdateViewport(boardId: number) {
    return useMutation({
        mutationFn: (viewport: { zoom: number; x: number; y: number }) =>
            webElectronApi.boards.updateViewport(boardId, viewport),
    });
}

export function useCreateEdge(boardId: number) {
    return useMutation({
        mutationFn: ({ sourceNodeId, targetNodeId }: { sourceNodeId: number; targetNodeId: number }) =>
            webElectronApi.boards.createEdge(boardId, sourceNodeId, targetNodeId),
    });
}

export function useDeleteEdge(boardId: number) {
    return useMutation({
        mutationFn: (edgeId: number) => webElectronApi.boards.deleteEdge(boardId, edgeId),
    });
}
