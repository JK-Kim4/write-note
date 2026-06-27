"use client";

/**
 * 빈 보드 안내(044, board-ux-worksheet TASK-1 ②) — 카드 0개 보드에서 캔버스(격자·툴바·줌 컨트롤)는
 * 그대로 둔 채 중앙에 "첫 카드 만들기" 안내만 얹는다. 보드를 통째로 가리는 별도 페이지가 아니라
 * 보드 위의 안내여야 한다(사용자 요청 2026-06-27). 컨테이너는 pointer-events-none 으로 캔버스 팬/빈 곳
 * 더블클릭을 막지 않고, 버튼만 클릭 가능(pointer-events-auto). 보드 colorMode=light 고정.
 */

// COPY = board-ux-worksheet.md §5 상수(card.emptyBoard / card.emptyBoardButton).
const EMPTY_BOARD_TEXT = "여기에 첫 카드를 적어보세요";
const EMPTY_BOARD_BUTTON = "+ 카드 만들기";

export function BoardEmptyGuide({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-base text-gray-500">{EMPTY_BOARD_TEXT}</p>
            <button
                type="button"
                onClick={onCreate}
                className="pointer-events-auto rounded-md bg-terracotta-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-terracotta-600"
            >
                {EMPTY_BOARD_BUTTON}
            </button>
        </div>
    );
}
