"use client";

/**
 * ChapterList (022 US1 T014) — A·B 공용 챕터 목록 presentational 컴포넌트.
 *
 * props:
 *  - chapters: 챕터 메타 배열 (sortOrder 순, 호출자가 정렬·로드 담당)
 *  - currentChapterId: 현재 편집 중인 챕터 ID (없으면 null)
 *  - onSelect(id): 챕터 선택 콜백
 *  - onCreate(): "새 챕터" 버튼 콜백
 *
 * 순수 표시 컴포넌트 — 데이터 fetch 금지. 'use client' 필수(onClick 핸들러).
 */

import type { ChapterMeta } from "@/lib/types/domain";

export type ChapterListProps = {
    chapters: ChapterMeta[];
    currentChapterId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
};

export function ChapterList({ chapters, currentChapterId, onSelect, onCreate }: ChapterListProps) {
    return (
        <div className="chapter-list">
            <div className="chapter-list__items">
                {chapters.map((chapter) => {
                    const isCurrent = chapter.id === currentChapterId;
                    return (
                        <button
                            key={chapter.id}
                            type="button"
                            aria-current={isCurrent ? "true" : undefined}
                            onClick={() => onSelect(chapter.id)}
                            className={`chapter-list__item${isCurrent ? " chapter-list__item--current" : ""}`}
                        >
                            {chapter.title || "(제목 없음)"}
                        </button>
                    );
                })}
            </div>
            <button type="button" onClick={onCreate} className="chapter-list__create">
                + 새 챕터
            </button>
        </div>
    );
}
