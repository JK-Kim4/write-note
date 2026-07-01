import { describe, expect, it } from "vitest";
import { filterCards } from "./cardFilter";
import type { CardItem } from "@/lib/api/cards";

function card(over: Partial<CardItem>): CardItem {
    return {
        id: 1,
        boardId: null,
        boardName: null,
        ownerType: null,
        ownerLabel: null,
        body: "",
        type: null,
        linkCount: 0,
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
        ...over,
    };
}

const cards: CardItem[] = [
    card({ id: 1, boardId: 3, boardName: "1부 플롯", body: "복선: 편지", type: "event" }),
    card({ id: 2, boardId: 3, boardName: "1부 플롯", body: "주인공 김서연", type: "character" }),
    card({ id: 3, boardId: null, boardName: null, body: "떠도는 메모", type: null }),
    card({ id: 4, boardId: null, boardName: null, body: "제목 후보", type: "theme" }),
];

const all = { query: "", owner: "all", type: "all" } as const;

describe("filterCards", () => {
    it("소속=독립 이면 board_id 없는 카드만", () => {
        const r = filterCards(cards, { ...all, owner: "standalone" });
        expect(r.map((c) => c.id)).toEqual([3, 4]);
    });

    it("소속=보드 이면 board_id 있는 카드만", () => {
        const r = filterCards(cards, { ...all, owner: "board" });
        expect(r.map((c) => c.id)).toEqual([1, 2]);
    });

    it("종류=character 이면 그 종류만", () => {
        const r = filterCards(cards, { ...all, type: "character" });
        expect(r.map((c) => c.id)).toEqual([2]);
    });

    it("종류=untyped 이면 무지정(type null)만", () => {
        const r = filterCards(cards, { ...all, type: "untyped" });
        expect(r.map((c) => c.id)).toEqual([3]);
    });

    it("문자열 검색은 본문·보드명 모두 대상", () => {
        expect(filterCards(cards, { ...all, query: "김서연" }).map((c) => c.id)).toEqual([2]);
        expect(filterCards(cards, { ...all, query: "1부" }).map((c) => c.id)).toEqual([1, 2]);
    });

    it("정렬(원 순서)을 바꾸지 않는다", () => {
        const r = filterCards(cards, all);
        expect(r.map((c) => c.id)).toEqual([1, 2, 3, 4]);
    });
});
