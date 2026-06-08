"use client";

/** document React Query 훅 (015 T013) — 활성 작품 문서 로드. 저장은 useAutoSave(006) 담당. */
import { useQuery } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";

export const documentKeys = {
    byProject: (projectId: number) => ["document", "byProject", projectId] as const,
};

export function useProjectDocument(projectId: number) {
    return useQuery({
        queryKey: documentKeys.byProject(projectId),
        queryFn: () => webElectronApi.documents.getByProject(projectId),
        enabled: Number.isFinite(projectId),
        retry: false,
    });
}
