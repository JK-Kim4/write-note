import type { ReactNode } from "react";

/**
 * AlertError — 폼 상단 알림 박스.
 *
 * Spec reference: contracts/route-surfaces.md §1 (login-error / signup-error)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — Apple System Red 톤
 *   (#d70015 라이트, #ff453a 다크) + tries 부제 ("남은 시도 N 회").
 */

interface AlertErrorProps {
    title: string;
    children?: ReactNode;
    tries?: string;
}

const ALERT_ICON = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.8" fill="currentColor" />
    </svg>
);

export function AlertError({ title, children, tries }: AlertErrorProps) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-card-memo p-4"
            style={{
                backgroundColor: "color-mix(in srgb, var(--w-error) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--w-error) 20%, transparent)",
                color: "var(--w-error)",
            }}
        >
            <span style={{ color: "var(--w-error)" }}>{ALERT_ICON}</span>
            <div className="flex-1 text-sm">
                <b style={{ color: "var(--w-error)", display: "block" }}>{title}</b>
                {children ? (
                    <div style={{ color: "var(--w-ink)", marginTop: 4 }}>{children}</div>
                ) : null}
                {tries ? (
                    <div
                        style={{
                            color: "var(--w-ink)",
                            opacity: 0.7,
                            marginTop: 6,
                            fontSize: "13px",
                        }}
                    >
                        {tries}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
