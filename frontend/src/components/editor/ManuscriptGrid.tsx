"use client";

import type { ManuscriptSize } from "@/stores/preferences";
import { getManuscriptDimensions } from "./manuscript";

/**
 * 원고지 격자 오버레이 컴포넌트 (006 T025).
 *
 * 설계 원칙 (spec 006 R-2):
 * - 격자는 CSS 표시 전용 레이어 — ProseMirror Decoration 으로 칸 노드 주입 금지
 *   (한국어 IME 조합 안정성 위협 — PoC 0-1 회귀 방지)
 * - 글자는 격자를 정확히 채우지 않아도 깨지지 않는 완화 모드
 * - 컬럼 마커: 5·10·15·20 위치에 굵은 선
 * - 행 번호: 좌측에 표시
 */

interface ManuscriptGridProps {
    /** 원고지 칸수 (200 | 400 | 1000) */
    size: ManuscriptSize;
    /** 표시할 매수 (최소 1) */
    pages?: number;
}

/** 특정 열 번호가 컬럼 마커 위치인지 판단 (5 의 배수, 1-indexed). */
const isColumnMarker = (col: number): boolean => col % 5 === 0;

export function ManuscriptGrid({ size, pages = 1 }: ManuscriptGridProps) {
    const { cols, rows } = getManuscriptDimensions(size);
    const totalPages = Math.max(1, pages);

    return (
        <div
            aria-hidden="true"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                pointerEvents: "none",
                userSelect: "none",
            }}
        >
            {Array.from({ length: totalPages }, (_, pageIdx) => (
                <ManuscriptPage
                    key={pageIdx}
                    pageNumber={pageIdx + 1}
                    cols={cols}
                    rows={rows}
                />
            ))}
        </div>
    );
}

interface ManuscriptPageProps {
    pageNumber: number;
    cols: number;
    rows: number;
}

function ManuscriptPage({ pageNumber, cols, rows }: ManuscriptPageProps) {
    // 칸 너비: 한 글자 고정폭 기준 ch 단위. 완화 모드 — 실제 글자 정렬은 dogfooding 검증 영역.
    const cellSize = "1.6em";

    return (
        <div
            style={{
                backgroundColor: "var(--w-manuscript-cream)",
                border: "1px solid var(--w-hairline)",
                borderRadius: "var(--w-radius-card-mode)",
                padding: "24px 24px 24px 40px", // 좌측 행 번호 공간
                position: "relative",
            }}
        >
            {/* 페이지 번호 */}
            <div
                style={{
                    fontSize: "10px",
                    color: "var(--w-ink)",
                    opacity: 0.4,
                    marginBottom: "8px",
                    letterSpacing: "0.05em",
                }}
            >
                {pageNumber}
            </div>

            {/* 격자 본체 */}
            <div style={{ display: "inline-flex", flexDirection: "column" }}>
                {/* 컬럼 헤더 (5 의 배수 위치만 숫자 표시) */}
                <div style={{ display: "flex", marginLeft: "20px", marginBottom: "2px" }}>
                    {Array.from({ length: cols }, (_, colIdx) => {
                        const col1 = colIdx + 1;
                        return (
                            <div
                                key={colIdx}
                                style={{
                                    width: cellSize,
                                    height: "12px",
                                    fontSize: "9px",
                                    color: "var(--w-ink)",
                                    opacity: isColumnMarker(col1) ? 0.5 : 0,
                                    textAlign: "center",
                                    lineHeight: "12px",
                                    flexShrink: 0,
                                }}
                            >
                                {isColumnMarker(col1) ? col1 : ""}
                            </div>
                        );
                    })}
                </div>

                {/* 격자 행 */}
                {Array.from({ length: rows }, (_, rowIdx) => (
                    <div key={rowIdx} style={{ display: "flex", alignItems: "center" }}>
                        {/* 행 번호 */}
                        <div
                            style={{
                                width: "18px",
                                fontSize: "9px",
                                color: "var(--w-ink)",
                                opacity: 0.4,
                                textAlign: "right",
                                paddingRight: "3px",
                                flexShrink: 0,
                                lineHeight: cellSize,
                            }}
                        >
                            {rowIdx + 1}
                        </div>

                        {/* 격자 칸들 */}
                        {Array.from({ length: cols }, (_, colIdx) => {
                            const col1 = colIdx + 1;
                            const isMarker = isColumnMarker(col1);
                            return (
                                <div
                                    key={colIdx}
                                    style={{
                                        width: cellSize,
                                        height: cellSize,
                                        flexShrink: 0,
                                        boxSizing: "border-box",
                                        border: "0.5px solid var(--w-hairline)",
                                        // 컬럼 마커 우측에 굵은 선
                                        borderRight: isMarker
                                            ? "1.5px solid color-mix(in srgb, var(--w-ink) 25%, transparent)"
                                            : "0.5px solid var(--w-hairline)",
                                    }}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
