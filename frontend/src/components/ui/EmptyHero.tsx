import type { ReactNode } from "react";

/**
 * EmptyHero — 빈 상태 hero (H0 빈 홈 + 빈 inbox 공용).
 *
 * Spec reference: contracts/route-surfaces.md §2-1 (H0)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — display 30px + prose lede.
 */

interface EmptyHeroProps {
    title: string;
    lede: ReactNode;
    cta?: ReactNode;
    hints?: ReactNode;
}

export function EmptyHero({ title, lede, cta, hints }: EmptyHeroProps) {
    return (
        <section className="flex flex-col items-center text-center gap-8 py-16 px-4 max-w-2xl mx-auto">
            <div className="flex flex-col gap-3">
                <h1
                    className="font-display font-semibold"
                    style={{ fontSize: "30px", color: "var(--w-ink)" }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        color: "var(--w-ink)",
                        opacity: 0.7,
                        fontSize: "17px",
                        lineHeight: 1.5,
                    }}
                >
                    {lede}
                </p>
            </div>
            {cta}
            {hints}
        </section>
    );
}
