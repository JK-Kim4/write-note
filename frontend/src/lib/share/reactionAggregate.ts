/**
 * 이모지 반응 낙관적 집계 갱신(050 US3) — 순수 함수.
 *
 * 서버 확정 전 `SharedWorkResponse.reactions`(구간별 공개 집계, C1 embed) 를 낙관적으로 갱신한다.
 * 토글 의미: 회원·구간·이모지당 최대 1개(FR-011/012) — add 는 mine 을 true 로, remove 는 false 로.
 * count 가 0 이 되면 항목 자체를 제거한다(빈 집계를 보여줄 필요 없음).
 */
import type { ReactionAggregate } from "@/lib/api/share";

export type ReactionAnchor = { blockIndex: number; start: number; length: number };

function sameAnchorAndEmoji(a: ReactionAggregate, anchor: ReactionAnchor, emoji: string): boolean {
    return (
        a.anchorBlockIndex === anchor.blockIndex &&
        a.anchorStart === anchor.start &&
        a.anchorLength === anchor.length &&
        a.emoji === emoji
    );
}

/** 낙관적으로 반응을 추가한 집계 목록을 반환한다(새 배열, 원본 불변). 이미 mine=true 면 그대로(멱등). */
export function applyReactionAdd(
    aggregates: readonly ReactionAggregate[],
    anchor: ReactionAnchor,
    emoji: string,
): ReactionAggregate[] {
    const idx = aggregates.findIndex((a) => sameAnchorAndEmoji(a, anchor, emoji));
    if (idx === -1) {
        return [
            ...aggregates,
            { anchorBlockIndex: anchor.blockIndex, anchorStart: anchor.start, anchorLength: anchor.length, emoji, count: 1, mine: true },
        ];
    }
    const existing = aggregates[idx];
    if (existing.mine) return aggregates.slice();
    const next = aggregates.slice();
    next[idx] = { ...existing, count: existing.count + 1, mine: true };
    return next;
}

/**
 * 낙관적으로 반응을 취소(토글 off)한 집계 목록을 반환한다(새 배열, 원본 불변).
 * mine=false 이거나 항목이 없으면 변화 없음. count 가 0 이 되면 항목을 제거한다.
 */
export function applyReactionRemove(
    aggregates: readonly ReactionAggregate[],
    anchor: ReactionAnchor,
    emoji: string,
): ReactionAggregate[] {
    const idx = aggregates.findIndex((a) => sameAnchorAndEmoji(a, anchor, emoji));
    if (idx === -1) return aggregates.slice();
    const existing = aggregates[idx];
    if (!existing.mine) return aggregates.slice();
    const nextCount = Math.max(0, existing.count - 1);
    const next = aggregates.slice();
    if (nextCount === 0) {
        next.splice(idx, 1);
    } else {
        next[idx] = { ...existing, count: nextCount, mine: false };
    }
    return next;
}

/** 특정 구간+이모지에 요청자 본인이 이미 반응했는지(있으면 그 집계, 없으면 undefined). */
export function findMineReaction(
    aggregates: readonly ReactionAggregate[],
    anchor: ReactionAnchor,
    emoji: string,
): ReactionAggregate | undefined {
    return aggregates.find((a) => sameAnchorAndEmoji(a, anchor, emoji) && a.mine);
}
