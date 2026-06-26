"use client";

import { keepEditorFocus } from "@/lib/keepEditorFocus";
import { goalProgress } from "@/lib/goalGauge";
import { InlineBoardList } from "@/components/board/InlineBoardList";

/**
 * B타입 집필 보조 패널 — 044 보드 중심 전환으로 메모·인물 탭 폐기, **보드 패널만** 남김.
 * 이 작품에 매달린 플롯 보드 목록 + 이름만 생성 + 열기(내부 탭, PRD §5.4 ②). ◀▶ 접이식 + 분량 푸터.
 * 메모·인물은 보드 카드로 통합(데이터·iOS 캡처는 BE 보존, 후속 "가져오기"로 카드화).
 */

type SidePanelProps = {
    projectId: number;
    /** controlled 접기 상태 — 두 인스턴스(inline·drawer)가 부모 state 를 공유. 미전달 시 비제어(로컬 state). */
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** 접기 토글(▶) 노출 여부. drawer 인스턴스(false)는 항상 펼친 상태. */
    collapsible?: boolean;
    /** 분량 지표(031) — 작품 전체 글자수(실시간) · 목표 분량 진행률. 패널 하단 고정 카드. */
    wordCount?: number;
    targetLength?: number | null;
};

export function BWorkSidePanel({
    projectId,
    isOpen: isOpenProp,
    onOpenChange,
    collapsible = true,
    wordCount,
    targetLength,
}: SidePanelProps) {
    const goal = wordCount != null && targetLength != null ? goalProgress(wordCount, targetLength) : null;
    // collapsible=false 면 항상 펼침(drawer 는 자체 ✕ 로만 닫는다).
    const isOpen = collapsible ? (isOpenProp ?? true) : true;
    const setIsOpen = (open: boolean) => onOpenChange?.(open);

    if (!isOpen) {
        return (
            <div className="flex w-8 shrink-0 flex-col items-center rounded-xl border border-gray-200 bg-gray-50 py-2">
                <button
                    type="button"
                    onMouseDown={keepEditorFocus}
                    aria-label="보조 패널 펼치기"
                    onClick={() => setIsOpen(true)}
                    className="rounded-md px-1 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                    ◀
                </button>
            </div>
        );
    }

    return (
        <div className="flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                <span className="text-sm font-medium text-terracotta-700">보드</span>
                {collapsible && (
                    <button
                        type="button"
                        onMouseDown={keepEditorFocus}
                        aria-label="보조 패널 접기"
                        onClick={() => setIsOpen(false)}
                        className="px-1 py-1 text-sm text-gray-400 hover:text-gray-600"
                    >
                        ▶
                    </button>
                )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <InlineBoardList ownerType="project" ownerId={projectId} emptyHint="아직 이 작품 보드가 없어요." />
            </div>
            {wordCount != null && (
                <div className="border-t border-gray-200 bg-white px-3 py-2.5">
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-500">분량</span>
                        {goal != null && <span className="text-sm font-bold text-gray-700">{goal.percent}%</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-700">
                        {wordCount.toLocaleString()}자{targetLength ? ` / ${targetLength.toLocaleString()}자` : ""}
                    </p>
                    {goal != null && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                                className="h-full rounded-full bg-terracotta-500"
                                style={{ width: `${Math.min(100, goal.percent)}%` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
