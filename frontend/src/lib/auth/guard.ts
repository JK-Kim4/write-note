"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthPlaceholder } from "@/stores/authPlaceholder";

/**
 * Auth route guard placeholder — client-side useEffect redirect.
 *
 * Spec reference: spec.md §FR-009/010 + research.md §"인증 라우트 가드 placeholder"
 *
 * 임시 — Week 1B-1 진입 시 middleware.ts + JWT cookie 검증으로 swap.
 * 본 hook 은 인증 신호 (userId 존재 여부) 만 검사.
 *
 * mode:
 *   - 'requireAuth': userId === null → /auth/login 으로 redirect
 *   - 'requireAnon': userId !== null → / 로 redirect (이미 인증된 사용자가 /auth/* 진입 시)
 */

export type GuardMode = "requireAuth" | "requireAnon";

export function useAuthGuard(mode: GuardMode): void {
    const router = useRouter();
    const userId = useAuthPlaceholder((state) => state.userId);

    useEffect(() => {
        if (mode === "requireAuth" && !userId) {
            router.replace("/auth/login");
            return;
        }
        if (mode === "requireAnon" && userId) {
            router.replace("/");
        }
    }, [mode, userId, router]);
}
