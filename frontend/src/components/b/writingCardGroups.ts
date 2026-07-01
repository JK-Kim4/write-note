import type { CardItem } from "@/lib/api/cards";
import type { BoardSummary } from "@/lib/api/boards";

/**
 * 집필 화면 카드 뷰(048 US6 / FR-019·FR-019a) 순수 그룹핑 헬퍼 — 신규 백엔드 0.
 *
 * `GET /api/cards`(전체 카드)와 `GET /boards/reference?projectId=`(그 작품 참조 보드)를 FE 에서 결합해
 * **이 작품 보드 → 상위 시리즈 보드 → 독립** 3단으로 나눈다(각 그룹 안 생성일 내림차순, 동률 id 내림차순).
 *
 * 참조 보드는 백엔드 `listReferenceBoards` 가 이미 그 작품 보드(owner=project)+상위 시리즈 보드(owner=category)
 * 로만 좁혀 주므로(BoardService.kt:104), `ownerType` 만으로 work/series 를 가른다(ownerId 스코프는 백엔드가 보장).
 * 참조 집합에 없는 보드 카드(다른 작품 보드·아이디어 보드)는 제외, 독립 카드(boardId null)는 solo.
 */

export type WritingCardGroupKey = "work" | "series" | "solo";

export interface WritingCardGroup {
    key: WritingCardGroupKey;
    title: string;
    cards: CardItem[];
}

/** 생성일 내림차순, 동률 시 id 내림차순(안정적 — 서버 목록 정렬과 정합). createdAt 은 ISO 문자열이라 사전순=시간순. */
function byCreatedDesc(a: CardItem, b: CardItem): number {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return b.id - a.id;
}

export function groupWritingCards(cards: CardItem[], referenceBoards: BoardSummary[]): WritingCardGroup[] {
    const workBoardIds = new Set(referenceBoards.filter((b) => b.ownerType === "project").map((b) => b.id));
    const seriesBoardIds = new Set(referenceBoards.filter((b) => b.ownerType === "category").map((b) => b.id));

    const work: CardItem[] = [];
    const series: CardItem[] = [];
    const solo: CardItem[] = [];
    for (const c of cards) {
        if (c.boardId == null) solo.push(c);
        else if (workBoardIds.has(c.boardId)) work.push(c);
        else if (seriesBoardIds.has(c.boardId)) series.push(c);
        // else: 무관 작품 보드/아이디어 보드 카드 → 이 작품 뷰에서 제외
    }

    return [
        { key: "work", title: "이 작품 보드", cards: [...work].sort(byCreatedDesc) },
        { key: "series", title: "시리즈 보드", cards: [...series].sort(byCreatedDesc) },
        { key: "solo", title: "독립 카드", cards: [...solo].sort(byCreatedDesc) },
    ];
}
