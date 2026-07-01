"use client";

/**
 * 이모지 반응(050 US3) React Query 훅 — 공개 페이지 구간 반응 추가/취소(토글).
 *
 * `useSharedWork` 캐시(`SharedWorkResponse.reactions`)를 낙관적으로 갱신한다(순수 갱신은
 * lib/share/reactionAggregate.ts). 실패 시 스냅샷으로 롤백, 성공/실패 무관 onSettled 에서 서버 재조회로 정합.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReaction, removeReaction } from "@/lib/api/share";
import type { CreateReactionInput, SharedWorkResponse } from "@/lib/api/share";
import { applyReactionAdd, applyReactionRemove } from "@/lib/share/reactionAggregate";
import { publicShareKeys } from "@/lib/query/useShares";

function useOptimisticReactionMutation(
    token: string,
    projectId: number,
    mutationFn: (input: CreateReactionInput) => Promise<SharedWorkResponse["reactions"][number]>,
    apply: (reactions: SharedWorkResponse["reactions"], input: CreateReactionInput) => SharedWorkResponse["reactions"],
) {
    const qc = useQueryClient();
    const workKey = publicShareKeys.work(token, projectId);
    return useMutation({
        mutationFn,
        onMutate: async (input: CreateReactionInput) => {
            await qc.cancelQueries({ queryKey: workKey });
            const previous = qc.getQueryData<SharedWorkResponse>(workKey);
            if (previous) {
                qc.setQueryData<SharedWorkResponse>(workKey, {
                    ...previous,
                    reactions: apply(previous.reactions ?? [], input),
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

function toAnchor(input: CreateReactionInput) {
    return { blockIndex: input.anchorBlockIndex, start: input.anchorStart, length: input.anchorLength };
}

/** 이모지 반응 추가 — 회원·구간·이모지당 unique(멱등). 비로그인 401 COMMENT_UNAUTHENTICATED. */
export function useAddReaction(token: string, projectId: number) {
    return useOptimisticReactionMutation(
        token,
        projectId,
        (input) => addReaction(token, projectId, input),
        (reactions, input) => applyReactionAdd(reactions, toAnchor(input), input.emoji),
    );
}

/** 이모지 반응 취소(토글 off) — 요청자 본인 반응만. */
export function useRemoveReaction(token: string, projectId: number) {
    return useOptimisticReactionMutation(
        token,
        projectId,
        (input) => removeReaction(token, projectId, input),
        (reactions, input) => applyReactionRemove(reactions, toAnchor(input), input.emoji),
    );
}
