import { describe, expect, it } from "vitest";
import { applyReactionAdd, applyReactionRemove, findMineReaction } from "./reactionAggregate";
import type { ReactionAggregate } from "@/lib/api/share";

const anchor = { blockIndex: 0, start: 3, length: 12 };

describe("applyReactionAdd — 낙관적 반응 추가(050 US3)", () => {
    it("해당 구간+이모지 집계가 없으면 count 1·mine true 로 새로 만든다", () => {
        const next = applyReactionAdd([], anchor, "❤️");
        expect(next).toEqual([
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: true },
        ]);
    });

    it("이미 다른 회원 반응이 있으면 count 를 올리고 mine 을 true 로 바꾼다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 2, mine: false },
        ];
        const next = applyReactionAdd(existing, anchor, "❤️");
        expect(next).toEqual([
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 3, mine: true },
        ]);
    });

    it("이미 내가 반응한 상태면 그대로다(멱등, 중복 카운트 없음)", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: true },
        ];
        const next = applyReactionAdd(existing, anchor, "❤️");
        expect(next).toEqual(existing);
    });

    it("같은 구간 다른 이모지는 별개 집계로 추가된다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: true },
        ];
        const next = applyReactionAdd(existing, anchor, "👍");
        expect(next).toHaveLength(2);
        expect(next[1]).toEqual({ anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "👍", count: 1, mine: true });
    });
});

describe("applyReactionRemove — 낙관적 반응 취소(050 US3)", () => {
    it("내 반응 count 를 내리고 mine 을 false 로 바꾼다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 3, mine: true },
        ];
        const next = applyReactionRemove(existing, anchor, "❤️");
        expect(next).toEqual([
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 2, mine: false },
        ]);
    });

    it("count 가 0 이 되면 집계 항목 자체를 제거한다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: true },
        ];
        const next = applyReactionRemove(existing, anchor, "❤️");
        expect(next).toEqual([]);
    });

    it("내가 반응한 적 없으면 아무 변화가 없다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 2, mine: false },
        ];
        const next = applyReactionRemove(existing, anchor, "❤️");
        expect(next).toEqual(existing);
    });

    it("해당 집계가 없으면 아무 변화가 없다", () => {
        const next = applyReactionRemove([], anchor, "❤️");
        expect(next).toEqual([]);
    });
});

describe("findMineReaction — 내 반응 조회", () => {
    it("mine=true 인 정확히 일치하는 항목을 반환한다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: true },
        ];
        expect(findMineReaction(existing, anchor, "❤️")).toEqual(existing[0]);
    });

    it("mine=false 면 undefined 다", () => {
        const existing: ReactionAggregate[] = [
            { anchorBlockIndex: 0, anchorStart: 3, anchorLength: 12, emoji: "❤️", count: 1, mine: false },
        ];
        expect(findMineReaction(existing, anchor, "❤️")).toBeUndefined();
    });

    it("일치하는 앵커·이모지가 없으면 undefined 다", () => {
        expect(findMineReaction([], anchor, "❤️")).toBeUndefined();
    });
});
