import type { ReactNode } from "react";

/**
 * HintCard — 빈 상태의 보조 안내 카드 (모바일/⌘+N 등).
 *
 * Spec reference: contracts/route-surfaces.md §2-1 (H0 의 hint card 2 개)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — 2 단 그리드용 작은 카드.
 */

interface HintCardProps {
    icon?: ReactNode;
    title: string;
    description: ReactNode;
}

export function HintCard({ icon, title, description }: HintCardProps) {
    return (
        <div
            className="flex flex-col items-start gap-2 p-5 text-left rounded-card-memo"
            style={{
                backgroundColor: "var(--w-canvas)",
                border: "1px solid var(--w-hairline)",
                color: "var(--w-ink)",
            }}
        >
            {icon ? <div style={{ color: "var(--w-accent)" }}>{icon}</div> : null}
            <div className="font-semibold" style={{ fontSize: "15px" }}>
                {title}
            </div>
            <div style={{ fontSize: "14px", opacity: 0.7 }}>{description}</div>
        </div>
    );
}
