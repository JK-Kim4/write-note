"use client";

type MemoView = { id: number; body: string; dateLabel: string };
type Props = { memos: ReadonlyArray<MemoView>; onNew: () => void; onOpenAll: () => void };

export function BMemoStrip({ memos, onNew, onOpenAll }: Props) {
    return (
        <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">메모</p>
                <button type="button" aria-label="메모 모두 보기" onClick={onOpenAll} className="text-xs text-accent-text hover:underline">
                    모두 보기 →
                </button>
            </div>
            {memos.length === 0 ? (
                <p className="mt-3 text-xs text-faint">아직 메모가 없어요</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {memos.map((m) => (
                        <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-ink-2">
                            {m.body}
                            <span className="ml-1 text-faint">· {m.dateLabel}</span>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                aria-label="새 메모 추가"
                onClick={onNew}
                className="mt-3 w-full rounded-lg border border-dashed border-border-strong py-2 text-xs text-accent-text"
            >
                + 새 메모
            </button>
        </div>
    );
}
