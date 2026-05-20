"use client";

import type { ReactNode } from "react";
import { useUi } from "@/stores/ui";

/**
 * SidePanel — 작성 화면의 사이드 참조 영역 골격.
 *
 * Spec reference: contracts/route-surfaces.md §2-2 (작성 surface 의 SidePanel)
 * Source: DESIGN.md §에디터 사이드 패널 — 프로젝트 메타 / 등장인물 / 연결된 메모.
 *
 * 본 spec 단계는 toggle + 골격 layout 만. 실제 카드 내용은 Week 2~4 영역.
 */

interface SidePanelProps {
    children?: ReactNode;
}

export function SidePanel({ children }: SidePanelProps) {
    const sidePanelOpen = useUi((s) => s.sidePanelOpen);
    if (!sidePanelOpen) {
        return null;
    }
    return (
        <aside
            className="w-80 shrink-0 px-4 py-4 overflow-y-auto"
            style={{
                backgroundColor: "var(--w-parchment)",
                borderLeft: "1px solid var(--w-hairline)",
            }}
        >
            {children ?? (
                <p style={{ color: "var(--w-ink)", opacity: 0.5, fontSize: "14px" }}>
                    프로젝트 메타 · 등장인물 · 연결된 메모 (placeholder)
                </p>
            )}
        </aside>
    );
}
