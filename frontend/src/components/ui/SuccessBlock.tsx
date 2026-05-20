import type { ReactNode } from "react";

/**
 * SuccessBlock — info/success 결과 화면 hero.
 *
 * Spec reference: contracts/route-surfaces.md §1 (reset-sent/reset-done/verify-pending/verify-done)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — accent blue 8% 배경 icon chip
 *   + display title + prose desc. brand-block 없이 단독 (결과 메시지가 hero).
 */

interface SuccessBlockProps {
    variant: "info" | "success";
    title: string;
    description?: ReactNode;
    icon?: ReactNode;
}

const DEFAULT_INFO_ICON = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 6l8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

const DEFAULT_SUCCESS_ICON = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
            d="M5 12l4 4 10-10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export function SuccessBlock({ variant, title, description, icon }: SuccessBlockProps) {
    const resolvedIcon = icon ?? (variant === "info" ? DEFAULT_INFO_ICON : DEFAULT_SUCCESS_ICON);
    return (
        <div className="flex flex-col items-center text-center gap-4 py-8">
            <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                    backgroundColor: "color-mix(in srgb, var(--w-accent) 8%, transparent)",
                    color: "var(--w-accent)",
                }}
            >
                {resolvedIcon}
            </div>
            <h1
                className="font-display font-semibold"
                style={{ fontSize: "26px", color: "var(--w-ink)" }}
            >
                {title}
            </h1>
            {description ? (
                <p style={{ color: "var(--w-ink)", opacity: 0.7, lineHeight: 1.5 }}>
                    {description}
                </p>
            ) : null}
        </div>
    );
}
