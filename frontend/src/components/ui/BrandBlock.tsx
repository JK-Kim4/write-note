/**
 * BrandBlock — 입구 카드 상단 일관 적용.
 *
 * Spec reference: contracts/route-surfaces.md §1-1 (auth shared layout)
 * 소설비 컬러 로고(워드마크 포함) + mode-label (accent blue, uppercase).
 */

interface BrandBlockProps {
    modeLabel?: string;
}

export function BrandBlock({ modeLabel }: BrandBlockProps) {
    return (
        <div className="flex flex-col items-center gap-2 mb-8">
            <div
                role="img"
                aria-label="소설비"
                style={{
                    width: "220px",
                    height: "82px",
                    backgroundImage: "url('/soseolbi-logo.png')",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                }}
            />
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
