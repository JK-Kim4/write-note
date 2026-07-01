import type { CardItem } from "@/lib/api/cards";

/** 소속 필터 — 전체 / 보드 소속 / 독립. */
export type OwnerFilter = "all" | "board" | "standalone";
/** 종류 필터 — 전체 / 4종 / 무지정. */
export type CardTypeFilter = "all" | "character" | "place" | "event" | "theme" | "untyped";

export interface CardFilterOptions {
    query: string;
    owner: OwnerFilter;
    type: CardTypeFilter;
}

/**
 * 카드 목록을 소속(전체/보드/독립)·종류(4종/무지정)·문자열(본문·보드명)로 좁힌다.
 * 정렬은 바꾸지 않는다(원 순서 유지) — 서버 생성일 내림차순을 그대로 보존.
 */
export function filterCards(cards: CardItem[], opts: CardFilterOptions): CardItem[] {
    const q = opts.query.trim().toLowerCase();
    return cards.filter((c) => {
        if (opts.owner === "board" && c.boardId == null) return false;
        if (opts.owner === "standalone" && c.boardId != null) return false;
        if (opts.type === "untyped" && c.type != null) return false;
        if (opts.type !== "all" && opts.type !== "untyped" && c.type !== opts.type) return false;
        if (q.length > 0) {
            const inBody = c.body.toLowerCase().includes(q);
            const inBoard = (c.boardName ?? "").toLowerCase().includes(q);
            if (!inBody && !inBoard) return false;
        }
        return true;
    });
}
