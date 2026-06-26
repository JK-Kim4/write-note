"use client";

/**
 * 홈 대시보드 우측 보드 패널(044 보드 중심 전환) — 메모 패널(BMemoStrip)을 대체.
 * 최근 보드 몇 개 + "모두 보기"(전역 허브) + "새 보드". 보드는 이야기 요소의 유일한 자리.
 */

type BoardView = { id: number; name: string; ownerLabel: string; cardCount: number };
type Props = {
    boards: ReadonlyArray<BoardView>;
    onOpen: (id: number) => void;
    onOpenAll: () => void;
    onNew: () => void;
};

export function BBoardStrip({ boards, onOpen, onOpenAll, onNew }: Props) {
    return (
        <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">보드</p>
                <button
                    type="button"
                    aria-label="보드 모두 보기"
                    onClick={onOpenAll}
                    className="text-xs text-terracotta-600 hover:underline"
                >
                    모두 보기 →
                </button>
            </div>
            {boards.length === 0 ? (
                <p className="mt-3 text-xs text-gray-400">아직 보드가 없어요</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {boards.map((b) => (
                        <li key={b.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(b.id)}
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-terracotta-300 hover:bg-terracotta-50"
                            >
                                <span className="truncate text-xs font-medium text-gray-700">{b.name}</span>
                                <span className="shrink-0 text-[11px] text-gray-400">
                                    {b.ownerLabel} · 카드 {b.cardCount}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                aria-label="새 보드 만들기"
                onClick={onNew}
                className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-terracotta-600"
            >
                + 새 보드
            </button>
        </div>
    );
}
