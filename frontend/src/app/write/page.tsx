"use client";

import { usePreferences } from "@/stores/preferences";

/**
 * Write page — preferences.writingMode 에 따라 manuscript vs editor layout 분기.
 *
 * Spec reference: contracts/route-surfaces.md §2-2 + Clarification §Q3
 * 본 spec 단계는 정적 placeholder. 실제 TipTap 본문 / 자수 카운팅 / 자동 저장은 Week 3 영역.
 */
export default function WritePage() {
    const writingMode = usePreferences((s) => s.writingMode);
    return writingMode === "manuscript" ? <ManuscriptLayout /> : <EditorLayout />;
}

function ManuscriptLayout() {
    return (
        <div className="px-6 py-10 max-w-4xl mx-auto">
            <div
                className="rounded-card-mode p-8"
                style={{
                    backgroundColor: "var(--w-manuscript-cream)",
                    border: "1px solid var(--w-hairline)",
                    fontFamily: "var(--w-font-manuscript)",
                    color: "var(--w-ink)",
                    lineHeight: 2,
                    fontSize: "18px",
                    minHeight: "70vh",
                }}
            >
                <div className="text-xs mb-6" style={{ opacity: 0.5 }}>
                    400 자 격자 · 20×20 · 컬럼 마커 5/10/15/20 · 행 번호 (placeholder)
                </div>
                <p style={{ opacity: 0.6 }}>
                    원고지 격자 본문은 Week 3 의 작성 phase 에서 본 layout 위에 합류합니다.
                </p>
            </div>
        </div>
    );
}

function EditorLayout() {
    return (
        <div className="flex flex-col h-full">
            <div
                className="flex items-center gap-1 px-4 py-2"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    borderBottom: "1px solid var(--w-hairline)",
                }}
            >
                {/* 풀 툴바 placeholder — DESIGN.md §화면 구성 */}
                {["B", "I", "U", "S", "❝", "•", "↶", "↷"].map((g) => (
                    <button
                        key={g}
                        type="button"
                        className="px-2 py-1 rounded-button-utility text-sm"
                        style={{ color: "var(--w-ink)", opacity: 0.7 }}
                    >
                        {g}
                    </button>
                ))}
            </div>
            <div
                className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full"
                style={{
                    fontFamily: "var(--w-font-prose)",
                    fontSize: "var(--w-prose-size)",
                    lineHeight: "var(--w-prose-line-height)",
                    color: "var(--w-ink)",
                }}
            >
                <p style={{ opacity: 0.6 }}>
                    TipTap 에디터 본문은 Week 3 의 작성 phase 에서 본 layout 위에 합류합니다.
                    한국어 IME 회귀 검증은 PoC 0-1 에서 박혔습니다.
                </p>
            </div>
        </div>
    );
}
