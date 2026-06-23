"use client";

/**
 * 모음(카테고리, 032) React Query 훅. 키 컨벤션은 projects 훅과 동형.
 * 이동(useMoveProjectCategory)은 낙관적 업데이트 — 드래그 드롭 즉시 카드가 옮겨 보이고 실패 시 롤백.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { projectKeys } from "./useProjects";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/lib/api/categories";
import type { ProjectCard } from "@/lib/types/domain";

export const categoryKeys = {
    all: ["categories"] as const,
    list: () => [...categoryKeys.all, "list"] as const,
};

export function useCategories() {
    return useQuery({
        queryKey: categoryKeys.list(),
        queryFn: () => webElectronApi.categories.list(),
        // 본문 글자수 변경 후 라이브러리 복귀마다 시리즈 진척(totalWordCount) 최신화 — 기본 staleTime 60s 캐시 미반영 방지(028 패턴)
        refetchOnMount: "always",
    });
}

export function useCreateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateCategoryInput) => webElectronApi.categories.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
    });
}

export function useRenameCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateCategoryInput }) =>
            webElectronApi.categories.update(id, input),
        // 시리즈 판형·출판방식 변경은 하위 작품 effective 에 영향 → projects(detail 포함) 무효화(033 R2 이슈3)
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryKeys.all });
            qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useDeleteCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => webElectronApi.categories.delete(id),
        // 삭제 시 소속 작품이 미분류로 전환되므로 카드도 무효화
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryKeys.all });
            qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

type MoveVars = { projectId: number; categoryId: number | null };

/** 작품을 모음으로 이동(032) — 낙관적 업데이트 + 실패 롤백. */
export function useMoveProjectCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, categoryId }: MoveVars) =>
            webElectronApi.categories.moveProject(projectId, categoryId),
        onMutate: async ({ projectId, categoryId }: MoveVars) => {
            await qc.cancelQueries({ queryKey: projectKeys.cards() });
            const previous = qc.getQueryData<ProjectCard[]>(projectKeys.cards());
            qc.setQueryData<ProjectCard[]>(projectKeys.cards(), (old) =>
                old?.map((c) => (c.id === projectId ? { ...c, categoryId } : c)),
            );
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) {
                qc.setQueryData(projectKeys.cards(), context.previous);
            }
        },
        onSettled: () => {
            // 이동은 작품 effective 판형을 바꾸므로 cards 뿐 아니라 detail(집필실)까지 무효화(033 R2 이슈5)
            qc.invalidateQueries({ queryKey: projectKeys.all });
            qc.invalidateQueries({ queryKey: categoryKeys.all });
        },
    });
}
