"use client";

/**
 * document React Query 훅 (015 T013).
 * 033: 챕터 제거 — 작품 1개 = 본문 1개.
 * - useProjectDocument: 작품의 단일 본문(메타+본문) 조회. 본문 id 해석에 사용.
 * - useChapterDocument: documentId 단건 본문 조회. 편집 세션 단독 소유(staleTime:Infinity).
 *   (이름은 BCustomChapterEditor 결선 호환을 위해 유지 — 단일 본문도 동일 훅 사용.)
 */
import { useQuery } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";

export const documentKeys = {
    project: (projectId: number) => ["project-document", projectId] as const,
    chapter: (documentId: number) => ["chapter", documentId] as const,
};

/**
 * 작품의 단일 본문 조회 — GET /api/projects/{projectId}/document.
 * 셸이 본문 id·제목·글자수·버전을 해석하는 데 사용. 편집은 useChapterDocument(documentId).
 */
export function useProjectDocument(projectId: number) {
    return useQuery({
        queryKey: documentKeys.project(projectId),
        queryFn: () => webElectronApi.documents.getByProject(projectId),
        enabled: Number.isFinite(projectId) && projectId > 0,
        retry: false,
    });
}

/**
 * 단건 본문 조회.
 * staleTime:Infinity + refetchOnWindowFocus:false — 016 정책. 편집 세션이 version 단독 소유.
 */
export function useChapterDocument(documentId: number) {
    return useQuery({
        queryKey: documentKeys.chapter(documentId),
        queryFn: () => webElectronApi.documents.get(documentId),
        enabled: Number.isFinite(documentId) && documentId > 0,
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });
}
