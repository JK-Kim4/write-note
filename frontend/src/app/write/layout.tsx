"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuthGuard } from "@/lib/auth/guard";
import { TopBar } from "@/components/shell/TopBar";
import { SidePanel } from "@/components/shell/SidePanel";
import { ProgressRing } from "@/components/shell/ProgressRing";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useUi } from "@/stores/ui";

/**
 * Write shared layout — `/write` 와 `/write/preview` 공통 shell.
 *
 * Spec reference: contracts/route-surfaces.md §2-2
 * 가드: requireAuth (FR-009).
 * 구조: TopBar (프로젝트 타이틀 / 진행 ring / 미리보기 진입 / 사이드 토글) + 본문 slot + SidePanel.
 */
export default function WriteLayout({ children }: { children: ReactNode }) {
    useAuthGuard("requireAuth");
    const sidePanelOpen = useUi((s) => s.sidePanelOpen);
    const setSidePanelOpen = useUi((s) => s.setSidePanelOpen);

    return (
        <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar
                title="첫 단막극"
                progress={<ProgressRing value={0} label="0 / 24,000 자" />}
                actions={
                    <>
                        <Link
                            href="/write/preview"
                            className="px-3 py-2 rounded-button-utility text-sm"
                            style={{ color: "var(--w-ink)", opacity: 0.8 }}
                        >
                            📖 미리보기
                        </Link>
                        <button
                            type="button"
                            onClick={() => setSidePanelOpen(!sidePanelOpen)}
                            className="px-3 py-2 rounded-button-utility text-sm"
                            style={{ color: "var(--w-ink)", opacity: 0.8 }}
                        >
                            ⊞
                        </button>
                        <ThemeToggle />
                    </>
                }
            />
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto">{children}</div>
                <SidePanel />
            </div>
        </div>
    );
}
