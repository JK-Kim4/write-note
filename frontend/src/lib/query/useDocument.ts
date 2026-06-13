"use client";

/**
 * document React Query 훅 (015 T013 + 022 US1 T013).
 * - useProjectChapters: 챕터 목록 (본문 제외 메타). ChapterList 에 전달.
 * - useChapterDocument: 단건 본문 포함 조회. staleTime:Infinity — 편집 세션 단독 소유.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webElectronApi } from "@/lib/electron-api";
import type { ChapterMeta } from "@/lib/types/domain";
import { LastChapterError } from "@/lib/api/client";

export const documentKeys = {
    chapters: (projectId: number) => ["chapters", projectId] as const,
    chapter: (documentId: number) => ["chapter", documentId] as const,
};

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

/**
 * 챕터 삭제(soft-delete) mutation — 022 US3 T030.
 *
 * memos 패턴과 동일한 낙관적 제거:
 * 1. onMutate: 챕터 목록 캐시에서 즉시 제거 → {previous} 반환
 * 2. 성공: onSettled 에서 캐시 무효화(서버 상태 동기)
 * 3. 실패: onError 에서 캐시 복원(롤백)
 *
 * LastChapterError(409 LAST_CHAPTER_UNDELETABLE) — 버튼 disabled(INV-1 1차 방어)로 대개 안 닿지만,
 * 닿으면 롤백만 하고 에러를 호출부로 전파(호출부가 토스트/알림 처리).
 */
export function useDeleteChapter(projectId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (documentId: number) => webElectronApi.documents.remove(documentId),
        onMutate: async (documentId: number) => {
            await queryClient.cancelQueries({ queryKey: documentKeys.chapters(projectId) });
            const previous = queryClient.getQueryData<ChapterMeta[]>(documentKeys.chapters(projectId));
            queryClient.setQueryData<ChapterMeta[]>(documentKeys.chapters(projectId), (cur) =>
                cur ? cur.filter((c) => c.id !== documentId) : cur,
            );
            return { previous };
        },
        onError: (_err, _id, ctx) => {
            if (ctx?.previous != null) {
                queryClient.setQueryData<ChapterMeta[]>(documentKeys.chapters(projectId), ctx.previous);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: documentKeys.chapters(projectId) });
        },
    });
}

/** 삭제된 챕터 복구 mutation — 022 US3 T030 (C5 POST /api/documents/{id}/restore). */
export function useRestoreChapter(projectId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (documentId: number) => webElectronApi.documents.restore(documentId),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: documentKeys.chapters(projectId) });
        },
    });
}

// LastChapterError export 재전달 — 호출부에서 별도 import 없이 사용 가능.
export { LastChapterError };

/**
 * 챕터 순서 이동 mutation — 022 US2 T022.
 *
 * ChapterList 의 onMove(id, direction) 콜백을 받아:
 * 1. 현재 캐시 목록에서 낙관적으로 순서 재계산
 * 2. 서버에 전체 id 배열 전송 (C3 PUT /api/projects/{projectId}/documents/order)
 * 3. 실패 시 캐시를 이전 상태로 롤백
 *
 * @param projectId 대상 작품 id
 */
export function useReorderChapters(projectId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (documentIds: number[]) => webElectronApi.documents.reorder(projectId, documentIds),
        onMutate: async (documentIds: number[]) => {
            // 진행 중인 refetch 취소 (낙관적 갱신 덮어쓰기 방지)
            await queryClient.cancelQueries({ queryKey: documentKeys.chapters(projectId) });
            const previous = queryClient.getQueryData<ChapterMeta[]>(documentKeys.chapters(projectId));

            // 낙관적 갱신: 전달된 id 순서로 캐시 재정렬
            if (previous != null) {
                const byId = new Map(previous.map((c) => [c.id, c]));
                const reordered = documentIds.flatMap((id, index) => {
                    const chapter = byId.get(id);
                    return chapter != null ? [{ ...chapter, sortOrder: index }] : [];
                });
                queryClient.setQueryData<ChapterMeta[]>(documentKeys.chapters(projectId), reordered);
            }

            return { previous };
        },
        onError: (_err, _ids, context) => {
            // 실패 시 이전 캐시 복원
            if (context?.previous != null) {
                queryClient.setQueryData<ChapterMeta[]>(documentKeys.chapters(projectId), context.previous);
            }
        },
        onSettled: () => {
            // 완료 후 서버 상태와 동기화
            void queryClient.invalidateQueries({ queryKey: documentKeys.chapters(projectId) });
        },
    });
}
