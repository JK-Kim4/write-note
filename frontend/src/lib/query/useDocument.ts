"use client";

/** document React Query 훅 (015 T013) — 활성 작품 문서 로드. 저장은 useDocumentSession(016) 담당. */
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
        // 016 — 편집 세션이 버전의 단독 소유자. 진입 1회 로드 후 편집 중 서버 재조회를 구조적으로 차단한다.
        // staleTime: Infinity 로 캐시를 영구 fresh 처리(자동 refetch 트리거 제거) + 창 포커스/재연결 refetch 차단.
        // 편집 중 끼어든 GET 이 (저장으로 이미 추월된) 서버 버전으로 세션 토큰을 되돌리던 거짓 409 충돌의 뿌리를 끊는다.
        // 작품 재진입 시 fresh 로드는 마운트(새 queryKey)에서 수행. 실제 교차기기 충돌은 저장 시 409 로 감지.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
