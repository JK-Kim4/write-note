"use client";

/**
 * projects React Query 훅 (015 T007) — webElectronApi 를 감싸 캐시/무효화 제공.
 * 키 컨벤션·무효화 패턴은 이후 도메인(memos/logs/sessions) 훅이 재사용.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import { archiveProject, listProjects, unarchiveProject } from "@/lib/api/projects";
import { clearLastProject, getLastProject } from "@/lib/lastProject";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/api/projects";
import type { Project, ProjectCard } from "@/lib/types/domain";

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

export function useArchiveProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => archiveProject(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}

export function useUnarchiveProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => unarchiveProject(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}

/** 보관된 작품 목록 — enabled=true 일 때만 조회. listProjects(전체) 에서 archivedAt!=null 필터. */
export function useArchivedProjects(enabled: boolean) {
    return useQuery({
        queryKey: [...projectKeys.all, "archived"] as const,
        queryFn: async (): Promise<Project[]> => {
            // archived=true 로 보관함만 조회. size 는 백엔드 상한(1..100) 이내 — 초과 시 400 (베타 작품 수엔 100 충분)
            const page = await listProjects({ size: 100, archived: true });
            return page.content;
        },
        enabled,
    });
}

export function useDeleteProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => webElectronApi.projects.delete(id),
        // 낙관적 제거 — 모달 닫힘과 동시에 카드가 캐시에서 즉시 사라진다(refetch 지연 잔존 방지).
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: projectKeys.cards() });
            const prev = qc.getQueryData<ProjectCard[]>(projectKeys.cards());
            qc.setQueryData<ProjectCard[]>(projectKeys.cards(), (old) => (old ?? []).filter((c) => c.id !== id));
            return { prev };
        },
        onError: (_err, _id, ctx) => {
            if (ctx?.prev !== undefined) qc.setQueryData(projectKeys.cards(), ctx.prev);
        },
        onSuccess: (_data, id) => {
            // 삭제된 작품이 "마지막으로 연 작품"이면 기억 해제 — Rail 이 stale id 로 진입 방지 (019 버그픽스 C).
            if (getLastProject() === id) clearLastProject();
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}
