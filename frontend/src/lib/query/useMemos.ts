"use client";

/**
 * memos React Query 훅 (015 T022) — webElectronApi.memos 를 감싸 캐시/무효화 제공.
 * 책상(전역 목록)·서랍(작품별)·캡처·고정·연결을 다룬다. 키·무효화는 useProjects 패턴 재사용.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import type { CaptureMemoInput } from "@/lib/electron-api/memos";
import { projectKeys } from "./useProjects";

export const memoKeys = {
    all: ["memos"] as const,
    inbox: () => [...memoKeys.all, "inbox"] as const,
    byProject: (projectId: number) => [...memoKeys.all, "project", projectId] as const,
};

/** 책상 — 전역 메모 목록(연결 작품 포함). */
export function useInboxMemos() {
    return useQuery({
        queryKey: memoKeys.inbox(),
        queryFn: () => webElectronApi.memos.list(),
    });
}

/** 서랍 — 현재 작품에 연결된 메모(고정 포함). */
export function useProjectMemos(projectId: number) {
    return useQuery({
        queryKey: memoKeys.byProject(projectId),
        queryFn: () => webElectronApi.memos.listByProject(projectId),
        enabled: Number.isFinite(projectId),
    });
}

/**
 * 메모 캡처(잉크 한 방울). 연결 시 작품 카드·서랍에도 영향 → 메모/작품 전체 무효화.
 * onSettled — create 는 캡처(POST) 후 선택적 연결(curation PUT) 2단계라, 연결 단계가 실패해도
 * 캡처된 메모(미연결)는 서버에 남는다. 성공·실패 모두 무효화해 캐시가 실제 상태를 반영하게 한다.
 */
export function useCaptureMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CaptureMemoInput) => webElectronApi.memos.create(input),
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: memoKeys.all });
            void qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

/** 메모 고정 토글(작품당 1개). 그 작품 서랍만 무효화. */
export function useSetPinMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ memoId, projectId, pinned }: { memoId: number; projectId: number; pinned: boolean }) =>
            webElectronApi.memos.setPin(memoId, projectId, pinned),
        onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: memoKeys.byProject(projectId) }),
    });
}

/** 작품 연결 추가(책상 붙이기). 책상·서랍 모두 영향 → 메모 전체 무효화. */
export function useAddLinkMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ memoId, projectId }: { memoId: number; projectId: number }) =>
            webElectronApi.memos.addLink(memoId, projectId),
        onSuccess: () => qc.invalidateQueries({ queryKey: memoKeys.all }),
    });
}

/** 작품 연결 해제(책상·서랍). 메모 전체 무효화. */
export function useRemoveLinkMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ memoId, projectId }: { memoId: number; projectId: number }) =>
            webElectronApi.memos.removeLink(memoId, projectId),
        onSuccess: () => qc.invalidateQueries({ queryKey: memoKeys.all }),
    });
}

/**
 * 메모 버리기(soft-delete). 낙관적으로 책상 캐시에서 즉시 제거(desktop 1:1) → 되돌리기 토스트.
 * 실패 시 onSettled 무효화가 서버 상태로 복원. 작품 서랍·재진입에도 영향 → 메모/작품 전체 무효화.
 */
export function useDeleteMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (memoId: number) => webElectronApi.memos.delete(memoId),
        onMutate: (memoId) => {
            const prev = qc.getQueryData(memoKeys.inbox());
            qc.setQueryData(memoKeys.inbox(), (cur: Awaited<ReturnType<typeof webElectronApi.memos.list>> | undefined) =>
                cur ? cur.filter((m) => m.id !== memoId) : cur,
            );
            return { prev };
        },
        onError: (_e, _memoId, ctx) => {
            if (ctx?.prev !== undefined) qc.setQueryData(memoKeys.inbox(), ctx.prev);
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: memoKeys.all });
            void qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

/** 버린 메모 되돌리기. 책상·서랍·재진입 복귀 → 메모/작품 전체 무효화. */
export function useRestoreMemo() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (memoId: number) => webElectronApi.memos.restore(memoId),
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: memoKeys.all });
            void qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}
