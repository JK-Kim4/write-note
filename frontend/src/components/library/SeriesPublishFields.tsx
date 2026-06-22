"use client";

import { PAPER_PRESETS, PAPER_SIZE_ORDER, type PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL } from "@/components/custom-editor/geometry";
import type { LayoutMode } from "@/types/api";

/**
 * 시리즈(카테고리) 출판 메타 입력 (033 R2) — 판형·출판방식.
 * 둘 다 선택(미설정 허용, null). 미설정 시 하위 작품은 시스템 기본값(A4/paper)으로 fallback.
 * 시리즈 생성 폼(LibraryBoard)·편집 폼(CategoryTile)이 공유한다.
 */
type SeriesPublishFieldsProps = {
    /** 입력 id 접두사 — 생성/편집 폼이 한 화면에 동시 존재할 수 있어 라벨 연결 충돌 회피용. */
    idPrefix: string;
    paperSize: PaperSize | null;
    layoutMode: LayoutMode | null;
    onPaperSizeChange: (size: PaperSize | null) => void;
    onLayoutModeChange: (mode: LayoutMode | null) => void;
};

export function SeriesPublishFields({
    idPrefix,
    paperSize,
    layoutMode,
    onPaperSizeChange,
    onLayoutModeChange,
}: SeriesPublishFieldsProps) {
    return (
        <div className="mt-2 space-y-2">
            <label htmlFor={`${idPrefix}-layout`} className="block text-xs text-gray-500">
                출판 방식
                <select
                    id={`${idPrefix}-layout`}
                    value={layoutMode ?? ""}
                    onChange={(e) => onLayoutModeChange(e.target.value === "" ? null : (e.target.value as LayoutMode))}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                >
                    <option value="">미설정 (기본값)</option>
                    <option value="paper">종이 출판 (페이지·판형)</option>
                    <option value="web">웹 출판 (연속·글자수)</option>
                </select>
            </label>
            {layoutMode !== "web" && (
                <label htmlFor={`${idPrefix}-paper`} className="block text-xs text-gray-500">
                    판형
                    <select
                        id={`${idPrefix}-paper`}
                        value={paperSize ?? ""}
                        onChange={(e) => onPaperSizeChange(e.target.value === "" ? null : (e.target.value as PaperSize))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                    >
                        <option value="">미설정 (기본값 A4)</option>
                        {PAPER_SIZE_ORDER.map((size) => (
                            <option key={size} value={size}>
                                {PAPER_LABEL[size]} ({PAPER_PRESETS[size].widthMm}×{PAPER_PRESETS[size].heightMm}mm)
                            </option>
                        ))}
                    </select>
                </label>
            )}
        </div>
    );
}
