"use client";

/**
 * projects React Query 훅 (015 T007) — webElectronApi 를 감싸 캐시/무효화 제공.
 * 키 컨벤션·무효화 패턴은 이후 도메인(memos/logs/sessions) 훅이 재사용.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/api/projects";

export const projectKeys = {
    all: ["projects"] as const,
    cards: () => [...projectKeys.all, "cards"] as const,
    detail: (id: number) => [...projectKeys.all, "detail", id] as const,
};

export function useProjectCards() {
    return useQuery({
        queryKey: projectKeys.cards(),
        queryFn: () => webElectronApi.projects.listCards(),
    });
}

export function useProject(id: number) {
    return useQuery({
        queryKey: projectKeys.detail(id),
        queryFn: () => webElectronApi.projects.get(id),
        enabled: Number.isFinite(id),
    });
}

export function useCreateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateProjectInput) => webElectronApi.projects.create(input),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}

export function useUpdateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: UpdateProjectInput }) =>
            webElectronApi.projects.update(id, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}

export function useDeleteProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => webElectronApi.projects.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}
