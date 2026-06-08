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
        // 편집 중 문서는 autosave 가 버전의 주인. 편집 도중 끼어드는 background refetch(창 포커스 전환·네트워크
        // 재연결)는 useAutoSave 의 version 동기화를 (이미 저장으로 추월된) 서버 버전으로 되돌려 거짓 409 충돌을 낸다.
        // → 이 둘만 끈다. 마운트 시 refetch 는 유지(작품 재진입 시 서버 최신 버전으로 fresh 로드). 실제 교차기기
        // 충돌은 저장 시 409 로 감지된다.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
