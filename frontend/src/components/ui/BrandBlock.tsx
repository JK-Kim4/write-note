/**
 * BrandBlock — 입구 카드 상단 일관 적용.
 *
 * Spec reference: contracts/route-surfaces.md §1-1 (auth shared layout)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — 펜촉 SVG icon chip (ink 배경)
 *   + write-note wordmark (display 22px) + mode-label (accent blue, uppercase)
 */

interface BrandBlockProps {
    modeLabel?: string;
}

export function BrandBlock({ modeLabel }: BrandBlockProps) {
    return (
        <div className="flex flex-col items-center gap-3 mb-8">
            <div
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-card-mode"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                {/* Pen-tip SVG icon chip */}
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M3 21l3.5-1L20 6.5 17.5 4 4 17.5 3 21z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                    <path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
            <span
                className="font-display font-semibold"
                style={{ fontSize: "22px", color: "var(--w-ink)" }}
            >
                write-note
            </span>
            {modeLabel ? (
                <span
                    className="uppercase tracking-widest text-xs font-semibold"
                    style={{ color: "var(--w-accent)", letterSpacing: "0.1em" }}
                >
                    {modeLabel}
                </span>
            ) : null}
        </div>
    );
}
