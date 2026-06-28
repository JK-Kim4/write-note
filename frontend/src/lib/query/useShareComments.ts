"use client";

/**
 * 공유 댓글(046 R4) React Query 훅 — 작가 인박스 조회 + 댓글 삭제.
 *
 * useAuthorComments = 작가가 자기 작품(projectId)에 달린 전체 댓글을 모아 본다.
 * useDeleteComment = 작성자 본인 댓글 삭제(타인 403). 공개 열람 댓글 레이어(R5)에서 소비.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorComments, createComment, deleteComment } from "@/lib/api/share";
import type { CommentResponse, CreateCommentInput, SharedWorkResponse } from "@/lib/api/share";
import { publicShareKeys } from "@/lib/query/useShares";

export const shareCommentKeys = {
    all: ["shareComments"] as const,
    author: (projectId: number) => [...shareCommentKeys.all, "author", projectId] as const,
};

/** 작가 인박스 — projectId 작품의 전체 댓글(최근순). 진입마다 최신 하이드레이션. */
export function useAuthorComments(projectId: number, enabled = true) {
    return useQuery({
        queryKey: shareCommentKeys.author(projectId),
        queryFn: () => authorComments(projectId),
        enabled: enabled && Number.isFinite(projectId),
        refetchOnMount: "always",
    });
}

/** 댓글 삭제(작성자 본인) — 성공 시 인박스/공개 댓글 캐시 무효화. */
export function useDeleteComment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteComment(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: shareCommentKeys.all });
            qc.invalidateQueries({ queryKey: publicShareKeys.all });
        },
    });
}

/** 임시(낙관) 댓글 id 는 음수 — 서버 응답 전까지 삭제 버튼 숨김 판별에 사용. */
export const isTempCommentId = (id: number): boolean => id < 0;

/**
 * 공개 페이지 댓글 작성(R5, 회원 필수). 낙관적으로 본인 댓글을 즉시 붙이고(temp 음수 id),
 * 성공/실패와 무관하게 onSettled 에서 서버 본문(SharedWorkResponse)을 invalidate → 실제 댓글로 교체.
 * 실패 시 onError 가 스냅샷으로 롤백한다.
 */
export function useCreateComment(token: string, projectId: number) {
    const qc = useQueryClient();
    const workKey = publicShareKeys.work(token, projectId);
    return useMutation({
        mutationFn: (input: CreateCommentInput) => createComment(token, projectId, input),
        onMutate: async (input: CreateCommentInput) => {
            await qc.cancelQueries({ queryKey: workKey });
            const previous = qc.getQueryData<SharedWorkResponse>(workKey);
            if (previous) {
                const optimistic: CommentResponse = {
                    id: -Date.now(), // temp 음수 id
                    anchorBlockIndex: input.anchorBlockIndex,
                    anchorStart: input.anchorStart,
                    anchorLength: input.anchorLength,
                    content: input.content,
                    authorNickname: "나",
                    createdAt: new Date().toISOString(),
                };
                qc.setQueryData<SharedWorkResponse>(workKey, {
                    ...previous,
                    comments: [optimistic, ...previous.comments],
                });
            }
            return { previous };
        },
        onError: (_err, _input, context) => {
            if (context?.previous) qc.setQueryData(workKey, context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: workKey }),
    });
}
