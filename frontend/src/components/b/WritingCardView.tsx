"use client";

import { CardTile } from "@/components/cards/CardTile";
import { useCardList } from "@/lib/query/useCards";
import { groupWritingCards } from "./writingCardGroups";
import type { CardItem } from "@/lib/api/cards";
import type { BoardSummary } from "@/lib/api/boards";

/**
 * 집필 참조 패널(048 US6)의 [카드] 뷰 — 그 작품 관련 보드 카드 + 독립 카드를
 * **이 작품 보드 → 시리즈 보드 → 독립** 3단 그룹(각 그룹 생성일 내림차순)으로 모아 본다(FR-019·019a).
 *
 * 조회는 신규 백엔드 0 — `GET /api/cards`(전량, [active] 일 때만) + 부모가 넘겨준 참조 보드(GET /boards/reference)
 * 를 `groupWritingCards` 로 결합·필터. 카드 열기는 부모가 관리하는 읽기 전용 상세(WritingCardDetail)로 위임한다.
 * 참조 보드 로드 중 grouping 하면 boarded 카드가 잠깐 전부 제외돼 보이므로 [boardsLoading] 도 함께 게이트한다.
 */
export function WritingCardView({
    referenceBoards,
    boardsLoading,
    active,
    onOpenCard,
}: {
    referenceBoards: BoardSummary[];
    boardsLoading: boolean;
    active: boolean;
    onOpenCard: (card: CardItem) => void;
}) {
    const cards = useCardList(active);

    if (boardsLoading || cards.isLoading) {
        return <p className="py-12 text-center text-sm text-gray-400">카드를 불러오는 중…</p>;
    }
    if (cards.isError) {
        return (
            <div className="py-12 text-center">
                <p className="text-sm text-gray-500">카드를 불러올 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => cards.refetch()}
                    className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    const groups = groupWritingCards(cards.data ?? [], referenceBoards).filter((g) => g.cards.length > 0);

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="max-w-xs text-sm text-gray-500">
                    이 작품과 곁들일 카드가 아직 없어요. 보드에 카드를 만들거나 독립 카드를 추가하면 여기서 함께
                    참조할 수 있어요.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {groups.map((g) => (
                <section key={g.key}>
                    <div className="mb-3 flex items-center gap-2">
                        <span className="text-[12.5px] font-bold text-gray-700">{g.title}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                            {g.cards.length}
                        </span>
                        <span className="h-px flex-1 bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                        {g.cards.map((c) => (
                            <CardTile key={c.id} card={c} onOpen={onOpenCard} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
