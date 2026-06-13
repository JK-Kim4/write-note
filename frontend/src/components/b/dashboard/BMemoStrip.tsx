"use client";

type MemoView = { id: number; body: string; dateLabel: string };
type Props = { memos: ReadonlyArray<MemoView>; onNew: () => void; onOpenAll: () => void };

export function BMemoStrip({ memos, onNew, onOpenAll }: Props) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">곁쪽지</p>
                <button type="button" aria-label="곁쪽지 모두 보기" onClick={onOpenAll} className="text-xs text-indigo-600 hover:underline">
                    모두 보기 →
                </button>
            </div>
            {memos.length === 0 ? (
                <p className="mt-3 text-xs text-gray-400">아직 곁쪽지가 없어요</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {memos.map((m) => (
                        <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-gray-700">
                            {m.body}
                            <span className="ml-1 text-gray-400">· {m.dateLabel}</span>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                aria-label="새 곁쪽지 추가"
                onClick={onNew}
                className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-indigo-600"
            >
                + 새 곁쪽지
            </button>
        </div>
    );
}
