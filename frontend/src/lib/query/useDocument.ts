"use client";

/**
 * document React Query 훅 (015 T013 + 022 US1 T013).
 * - useProjectDocument: 활성 작품 문서 로드 (레거시, 단수). 저장은 useDocumentSession(016) 담당.
 * - useProjectChapters: 챕터 목록 (본문 제외 메타). ChapterList 에 전달.
 * - useChapterDocument: 단건 본문 포함 조회. staleTime:Infinity — 편집 세션 단독 소유.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import type { ChapterMeta } from "@/lib/types/domain";

export const documentKeys = {
    byProject: (projectId: number) => ["document", "byProject", projectId] as const,
    chapters: (projectId: number) => ["chapters", projectId] as const,
    chapter: (documentId: number) => ["chapter", documentId] as const,
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

/**
 * 챕터 목록 (본문 제외 메타) — 022 US1 T013.
 * sortOrder 순 정렬은 서버 응답 순서 신뢰(백엔드 ORDER BY sort_order).
 */
export function useProjectChapters(projectId: number) {
    return useQuery({
        queryKey: documentKeys.chapters(projectId),
        queryFn: () => webElectronApi.documents.list(projectId),
        enabled: Number.isFinite(projectId) && projectId > 0,
        retry: false,
    });
}

/**
 * 챕터 단건 본문 조회 — 022 US1 T013.
 * staleTime:Infinity + refetchOnWindowFocus:false — useProjectDocument 와 동일 016 정책.
 * 편집 세션이 version 단독 소유. 챕터 전환 시 새 documentId 로 마운트 → fresh 로드.
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

/**
 * 챕터 생성 mutation — 022 US1 T013.
 * 성공 시 챕터 목록 캐시를 무효화(refetch 트리거). 새 챕터 documentId 를 반환.
 */
export function useCreateChapter(projectId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (title: string | undefined = undefined) => webElectronApi.documents.create(projectId, title),
        onSuccess: (newDoc) => {
            // 생성된 챕터를 목록 캐시에 메타로 즉시 추가 (refetch 없이 낙관적 갱신).
            queryClient.setQueryData<ChapterMeta[]>(documentKeys.chapters(projectId), (old) => {
                if (!old) return old;
                const meta: ChapterMeta = {
                    id: newDoc.id,
                    projectId: newDoc.projectId,
                    title: newDoc.title,
                    sortOrder: old.length + 1,
                    wordCount: newDoc.wordCount,
                    updatedAt: newDoc.updatedAt,
                };
                return [...old, meta];
            });
        },
    });
}
