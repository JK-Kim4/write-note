"use client";

import { useState } from "react";
import { PAPER_PRESETS, PAPER_SIZE_ORDER, type PaperSize } from "@/components/editor/pageLayout";
import { PAPER_LABEL } from "@/components/custom-editor/geometry";
import type { LayoutMode } from "@/types/api";

/**
 * 장르 추천 프리셋(033 R3) — 전통 문학(상단) → 장르문학·웹소설(하단) 순. "직접 입력…" 선택 시 자유 입력.
 */
const GENRE_PRESETS = [
    "일반소설", "청소년", "시", "에세이", "희곡", "시나리오",
    "판타지", "현대 판타지", "로맨스", "로맨스 판타지", "무협", "미스터리/추리",
    "스릴러", "SF", "호러", "게임 판타지", "대체역사", "라이트노벨",
] as const;
const GENRE_PRESET_SET: ReadonlySet<string> = new Set(GENRE_PRESETS);
/** select 의 "직접 입력" 옵션 식별값(실제 장르 값과 충돌 없게). */
const GENRE_CUSTOM = "__custom__";

const FIELD_CLASS =
    "mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-terracotta-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1";

/**
 * 시리즈(카테고리) 메타 입력 (033) — 장르·줄거리(R3) + 판형·출판방식(R2).
 * 전부 선택(미설정 허용, null). 미설정 시 하위 작품은 시스템 기본값(A4/paper)으로 fallback.
 * 시리즈 생성 폼(LibraryBoard)·편집 폼(CategoryTile)이 공유한다.
 */
type SeriesPublishFieldsProps = {
    /** 입력 id 접두사 — 생성/편집 폼이 한 화면에 동시 존재할 수 있어 라벨 연결 충돌 회피용. */
    idPrefix: string;
    genre: string;
    synopsis: string;
    paperSize: PaperSize | null;
    layoutMode: LayoutMode | null;
    /** 시리즈 총 목표 분량 글자수(033 R4). null=미설정(빈값). */
    targetLength: number | null;
    onGenreChange: (genre: string) => void;
    onSynopsisChange: (synopsis: string) => void;
    onPaperSizeChange: (size: PaperSize | null) => void;
    onLayoutModeChange: (mode: LayoutMode | null) => void;
    onTargetLengthChange: (length: number | null) => void;
};

export function SeriesPublishFields({
    idPrefix,
    genre,
    synopsis,
    paperSize,
    layoutMode,
    targetLength,
    onGenreChange,
    onSynopsisChange,
    onPaperSizeChange,
    onLayoutModeChange,
    onTargetLengthChange,
}: SeriesPublishFieldsProps) {
    // 장르: 드롭다운(추천 18종 + "직접 입력") — 클릭 선택 확실. 직접 입력 선택 시 자유 텍스트 칸.
    // 초기엔 현재 genre 가 프리셋 밖(이미 직접 입력해 둔 값)이면 직접 입력 모드로 연다.
    const [genreCustom, setGenreCustom] = useState(genre !== "" && !GENRE_PRESET_SET.has(genre));
    const genreSelectValue = genreCustom ? GENRE_CUSTOM : GENRE_PRESET_SET.has(genre) ? genre : "";
    const handleGenreSelect = (value: string) => {
        if (value === GENRE_CUSTOM) {
            setGenreCustom(true);
            onGenreChange("");
        } else {
            setGenreCustom(false);
            onGenreChange(value);
        }
    };

    return (
        <div className="mt-2 space-y-2">
            <label htmlFor={`${idPrefix}-genre`} className="block text-xs text-gray-500">
                장르
                <select
                    id={`${idPrefix}-genre`}
                    value={genreSelectValue}
                    onChange={(e) => handleGenreSelect(e.target.value)}
                    className={FIELD_CLASS}
                >
                    <option value="">미설정</option>
                    {GENRE_PRESETS.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                    <option value={GENRE_CUSTOM}>직접 입력…</option>
                </select>
            </label>
            {genreCustom && (
                <input
                    value={genre}
                    onChange={(e) => onGenreChange(e.target.value)}
                    placeholder="장르 직접 입력"
                    maxLength={100}
                    aria-label="장르 직접 입력"
                    className={FIELD_CLASS}
                />
            )}
            <label htmlFor={`${idPrefix}-synopsis`} className="block text-xs text-gray-500">
                줄거리
                <textarea
                    id={`${idPrefix}-synopsis`}
                    value={synopsis}
                    onChange={(e) => onSynopsisChange(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    className={FIELD_CLASS}
                />
            </label>
            <label htmlFor={`${idPrefix}-target`} className="block text-xs text-gray-500">
                목표 분량(글자수)
                <input
                    id={`${idPrefix}-target`}
                    type="number"
                    value={targetLength ?? ""}
                    onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                            onTargetLengthChange(null);
                            return;
                        }
                        const parsed = Math.trunc(Number(raw));
                        onTargetLengthChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
                    }}
                    min={0}
                    step={1}
                    placeholder="예: 300000"
                    className={FIELD_CLASS}
                />
            </label>
            <label htmlFor={`${idPrefix}-layout`} className="block text-xs text-gray-500">
                출판 방식
                <select
                    id={`${idPrefix}-layout`}
                    value={layoutMode ?? ""}
                    onChange={(e) => onLayoutModeChange(e.target.value === "" ? null : (e.target.value as LayoutMode))}
                    className={FIELD_CLASS}
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
                        className={FIELD_CLASS}
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
