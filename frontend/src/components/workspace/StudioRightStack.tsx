"use client";

import { useState } from "react";
import type { InboxMemo } from "@/lib/types/domain";
import { CharacterPanel } from "./CharacterPanel";
import { MemoPanel } from "./MemoPanel";

type StudioRightStackProps = {
    projectId: number;
    /** 메모(MemoPanel) props — 동작 불변(017 FR-017). */
    memos: InboxMemo[];
    memosLoading: boolean;
    onUnlink: (memoId: number) => void;
    onSetPin: (memoId: number, pinned: boolean) => void;
};

/**
 * 우측 패널 스택(017 US2/US3) — 인물 노트(상단) + 메모(하단) 세로 스택, 섹션별 개별 접기.
 * MemoPanel 은 props·동작 불변으로 재사용.
 */
export function StudioRightStack({ projectId, memos, memosLoading, onUnlink, onSetPin }: StudioRightStackProps) {
    const [charOpen, setCharOpen] = useState(true);
    const [memoOpen, setMemoOpen] = useState(true);

    return (
        <aside className="studio-right" aria-label="맥락 패널">
            <section className="stack-section">
                <button
                    type="button"
                    className="stack-section__toggle"
                    aria-expanded={charOpen}
                    onClick={() => setCharOpen((v) => !v)}
                >
                    <span>인물</span>
                    <span className="stack-section__chevron" aria-hidden="true">
                        {charOpen ? "▾" : "▸"}
                    </span>
                </button>
                {charOpen ? <CharacterPanel projectId={projectId} /> : null}
            </section>

            <section className="stack-section">
                <button
                    type="button"
                    className="stack-section__toggle"
                    aria-expanded={memoOpen}
                    onClick={() => setMemoOpen((v) => !v)}
                >
                    <span>메모</span>
                    <span className="stack-section__chevron" aria-hidden="true">
                        {memoOpen ? "▾" : "▸"}
                    </span>
                </button>
                {memoOpen ? (
                    <MemoPanel memos={memos} loading={memosLoading} onUnlink={onUnlink} onSetPin={onSetPin} />
                ) : null}
            </section>
        </aside>
    );
}
