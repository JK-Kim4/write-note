import Link from "next/link";

/**
 * Preview page — 작성 화면에서 진입하는 임시 view (DESIGN.md §핵심 UX 결정 §1).
 *
 * Spec reference: contracts/route-surfaces.md §2-2 + FR-008
 * 본 spec 단계는 정적 외관 + "편집으로 돌아가기" 동작.
 */
export default function PreviewPage() {
    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: "var(--w-parchment)" }}>
            <div className="flex-1 overflow-y-auto px-8 py-12 max-w-3xl mx-auto w-full">
                <article
                    style={{
                        fontFamily: "var(--w-font-prose)",
                        fontSize: "var(--w-prose-size)",
                        lineHeight: "var(--w-prose-line-height)",
                        color: "var(--w-ink)",
                    }}
                >
                    <h1
                        className="font-display font-semibold mb-6"
                        style={{ fontSize: "28px" }}
                    >
                        첫 단막극 (미리보기)
                    </h1>
                    <p style={{ opacity: 0.7 }}>
                        본문 미리보기는 Week 3 의 작성 phase 에서 본 layout 위에 합류합니다.
                        페이지 break / 진행률 / 목차 / prev-next 동작은 Week 6 영역.
                    </p>
                </article>
            </div>
            <footer
                className="sticky bottom-0 px-6 py-3 flex items-center justify-between"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    borderTop: "1px solid var(--w-hairline)",
                }}
            >
                <Link
                    href="/write"
                    className="text-sm font-semibold"
                    style={{ color: "var(--w-ink)" }}
                >
                    ← 편집으로 돌아가기
                </Link>
                <span style={{ fontSize: "13px", color: "var(--w-ink)", opacity: 0.5 }}>
                    페이지 1 / 1 · 진행률 0% (placeholder)
                </span>
            </footer>
        </div>
    );
}
