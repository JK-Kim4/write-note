import { describe, expect, it } from "vitest";
import { groupWritingCards } from "./writingCardGroups";
import type { CardItem } from "@/lib/api/cards";
import type { BoardSummary } from "@/lib/api/boards";

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

function board(over: Partial<BoardSummary>): BoardSummary {
    return {
        id: 1,
        name: "보드",
        ownerType: null,
        ownerId: null,
        ownerLabel: "아이디어",
        cardCount: 0,
        updatedAt: "2026-07-01T00:00:00Z",
        ...over,
    };
}

// 참조 보드 = 그 작품 보드(owner=project) + 상위 시리즈 보드(owner=category)만.
const refBoards: BoardSummary[] = [
    board({ id: 10, ownerType: "project", ownerLabel: "지워진 이름" }),
    board({ id: 20, ownerType: "category", ownerLabel: "안개 연작" }),
];

describe("groupWritingCards", () => {
    it("이 작품 보드 → 시리즈 보드 → 독립 3단 그룹(고정 순서·제목)으로 나눈다", () => {
        const groups = groupWritingCards([], refBoards);
        expect(groups.map((g) => g.key)).toEqual(["work", "series", "solo"]);
        expect(groups.map((g) => g.title)).toEqual(["이 작품 보드", "시리즈 보드", "독립 카드"]);
    });

    it("카드를 참조 보드 소유(project/category)·독립으로 분류하고, 무관 보드 카드는 제외한다", () => {
        const cards: CardItem[] = [
            card({ id: 1, boardId: 10 }), // work
            card({ id: 3, boardId: 20 }), // series
            card({ id: 4, boardId: 99 }), // 다른 작품/아이디어 보드 → 제외
            card({ id: 6, boardId: null }), // solo
        ];
        const groups = groupWritingCards(cards, refBoards);
        const by = (k: string) => groups.find((g) => g.key === k)!.cards.map((c) => c.id);
        expect(by("work")).toEqual([1]);
        expect(by("series")).toEqual([3]);
        expect(by("solo")).toEqual([6]);
        expect(groups.flatMap((g) => g.cards.map((c) => c.id))).not.toContain(4);
    });

    it("각 그룹 안에서 생성일 내림차순(동률 시 id 내림차순)으로 정렬한다", () => {
        const cards: CardItem[] = [
            card({ id: 1, boardId: 10, createdAt: "2026-06-25T00:00:00Z" }),
            card({ id: 2, boardId: 10, createdAt: "2026-06-27T00:00:00Z" }),
            card({ id: 5, boardId: 10, createdAt: "2026-06-27T00:00:00Z" }), // id 2 와 동률 → id desc
            card({ id: 6, boardId: null, createdAt: "2026-06-22T00:00:00Z" }),
            card({ id: 7, boardId: null, createdAt: "2026-07-01T00:00:00Z" }),
        ];
        const groups = groupWritingCards(cards, refBoards);
        const by = (k: string) => groups.find((g) => g.key === k)!.cards.map((c) => c.id);
        expect(by("work")).toEqual([5, 2, 1]);
        expect(by("solo")).toEqual([7, 6]);
    });

    it("참조 보드가 없어도 독립 카드는 solo 그룹에 담긴다(보드 0 + 독립 N)", () => {
        const groups = groupWritingCards([card({ id: 6, boardId: null })], []);
        expect(groups.find((g) => g.key === "solo")!.cards.map((c) => c.id)).toEqual([6]);
        expect(groups.find((g) => g.key === "work")!.cards).toEqual([]);
    });

    it("입력 배열을 변형하지 않는다(정렬은 새 배열)", () => {
        const cards: CardItem[] = [
            card({ id: 1, boardId: 10, createdAt: "2026-06-25T00:00:00Z" }),
            card({ id: 2, boardId: 10, createdAt: "2026-06-27T00:00:00Z" }),
        ];
        groupWritingCards(cards, refBoards);
        expect(cards.map((c) => c.id)).toEqual([1, 2]);
    });
});
