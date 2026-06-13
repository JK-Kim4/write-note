"use client";

import type { InboxMemo } from "@/lib/types/domain";

type MemoPanelProps = {
    /** 현재 작품에 연결된 메모(서랍 뷰). */
    memos: InboxMemo[];
    loading: boolean;
    /** 패널 내 빠른 해제 — 현재 작품과의 연결을 끊는다. */
    onUnlink: (memoId: number) => void;
    /** 메모 고정 토글 — 재진입 시 한 장으로 떠오를 쪽지를 정한다(작품당 1개). */
    onSetPin: (memoId: number, pinned: boolean) => void;
};

/** 연결된 메모 패널(메모 서랍) — desktop MemoPanel 1:1 이식(015 US2). 에디터보다 시각적으로 약하게. */
export function MemoPanel({ memos, loading, onUnlink, onSetPin }: MemoPanelProps) {
    const sub = loading ? "불러오는 중" : `${memos.length}개`;

    return (
        <aside className="side-panel" aria-label="연결된 메모">
            <div className="panel__head">
                <h2 className="panel__title">연결된 메모</h2>
                <p className="panel__sub">{sub}</p>
            </div>

            {loading ? (
                <div className="panel__list" aria-hidden="true">
                    {[0, 1].map((i) => (
                        <div key={i} className="skel">
                            <div className="skel__bar" />
                            <div className="skel__bar" />
                            <div className="skel__bar" />
                        </div>
                    ))}
                </div>
            ) : memos.length === 0 ? (
                <div className="panel__empty">
                    이 작품에 연결된 메모가
                    <br />
                    아직 없어요.
                </div>
            ) : (
                <div className="panel__list">
                    {memos.map((memo, i) => {
                        const pinned = memo.pinned === true;
                        return (
                            <article
                                key={memo.id}
                                className={pinned ? "memo memo--pinned" : "memo"}
                                style={{ animationDelay: `${40 + i * 50}ms` }}
                            >
                                <p className="memo__body">{memo.body}</p>
                                <div className="memo__foot">
                                    <span className="memo__date">{memo.dateLabel}</span>
                                    <button
                                        type="button"
                                        className="memo__pin"
                                        aria-pressed={pinned}
                                        aria-label={pinned ? "곁에 둘 쪽지 고정 해제" : "곁에 둘 쪽지로 고정"}
                                        title={pinned ? "곁에 둘 쪽지 고정 해제" : "곁에 둘 쪽지로 고정"}
                                        onClick={() => onSetPin(memo.id, !pinned)}
                                    >
                                        {pinned ? "★" : "☆"}
                                    </button>
                                    <button
                                        type="button"
                                        className="memo__unlink"
                                        aria-label="연결 해제"
                                        onClick={() => onUnlink(memo.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </aside>
    );
}
