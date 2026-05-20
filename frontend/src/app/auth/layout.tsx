"use client";

import type { ReactNode } from "react";
import { BrandBlock } from "@/components/ui/BrandBlock";
import { useAuthGuard } from "@/lib/auth/guard";

/**
 * Auth shared layout — 12 인증 panel route 의 공통 shell.
 *
 * Spec reference: spec.md §FR-001/002/010 + contracts/route-surfaces.md §1-1 + Clarification §Q2
 *
 * 구조: BrandBlock + 카드 컨테이너 (children slot)
 * 가드: 인증 상태에서 /auth/* 직접 진입 시 / 로 redirect (requireAnon)
 *
 * panel 간 전환 시 본 layout 유지, 자식 page 만 교체 — wireframe panel toggle 외관 재현.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    useAuthGuard("requireAnon");
    return (
        <main
            className="flex min-h-screen items-center justify-center px-4 py-12"
            style={{ backgroundColor: "var(--w-parchment)" }}
        >
            <div
                className="w-full max-w-md rounded-card-project px-8 py-10"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                }}
            >
                <BrandBlock />
                {children}
            </div>
        </main>
    );
}
