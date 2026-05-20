import type { ReactNode } from "react";

/**
 * TopBar — 메인/작성 view 공유 shell.
 *
 * Spec reference: contracts/route-surfaces.md §2-2 + plan.md Project Structure
 * Source: DESIGN.md §7 분리 원칙 — 프로젝트 타이틀 / 진행 ring / 미리보기 진입 / 사이드 토글.
 *
 * 본 spec 단계는 layout slot 만 보유. 실제 동작은 후속 phase 합류.
 */

interface TopBarProps {
    title?: ReactNode;
    progress?: ReactNode;
    actions?: ReactNode;
}

export function TopBar({ title, progress, actions }: TopBarProps) {
    return (
        <header
            className="flex items-center justify-between px-6 py-3"
            style={{
                backgroundColor: "var(--w-canvas)",
                borderBottom: "1px solid var(--w-hairline)",
            }}
        >
            <div className="flex items-center gap-4">
                {title ? (
                    <span className="font-display font-semibold" style={{ color: "var(--w-ink)" }}>
                        {title}
                    </span>
                ) : null}
                {progress}
            </div>
            <div className="flex items-center gap-3">{actions}</div>
        </header>
    );
}
