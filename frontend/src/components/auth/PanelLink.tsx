import Link from "next/link";
import type { ReactNode } from "react";

/**
 * PanelLink — 인증 패널 간 인라인 해결 경로 링크.
 *
 * Spec reference: contracts/route-surfaces.md §1-2 (인라인 해결 경로 링크)
 * Source: DESIGN.md §핵심 인증 UX 결정 §6 — "이미 가입된 이메일입니다. 로그인하기 →"
 */

interface PanelLinkProps {
    href: string;
    children: ReactNode;
    variant?: "accent" | "muted";
}

export function PanelLink({ href, children, variant = "accent" }: PanelLinkProps) {
    const color = variant === "accent" ? "var(--w-accent)" : "var(--w-ink)";
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            style={{ color, opacity: variant === "muted" ? 0.7 : 1, fontSize: "14px" }}
        >
            {children}
        </Link>
    );
}
