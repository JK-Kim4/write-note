"use client";

/**
 * 빈 보드 안내(044, board-ux-worksheet TASK-1 ②) — 카드 0개 보드에서 빈 격자 캔버스 대신
 * 중앙 단일 진입점을 노출한다(빈 캔버스 절대 노출 금지). 캔버스 위 불투명 오버레이로 격자를 덮는다.
 * 버튼은 캔버스의 카드 생성(중앙)을 호출 → 생성 직후 자동 본문 편집(autoEdit). 보드 colorMode=light 고정.
 */

// COPY = board-ux-worksheet.md §5 상수(card.emptyBoard / card.emptyBoardButton).
const EMPTY_BOARD_TEXT = "여기에 첫 카드를 적어보세요";
const EMPTY_BOARD_BUTTON = "+ 카드 만들기";

export function BoardEmptyGuide({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-white text-center">
            <p className="text-base text-gray-500">{EMPTY_BOARD_TEXT}</p>
            <button
                type="button"
                onClick={onCreate}
                className="rounded-md bg-terracotta-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-terracotta-600"
            >
                {EMPTY_BOARD_BUTTON}
            </button>
        </div>
    );
}
