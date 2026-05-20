"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { useThemeEffect } from "@/components/theme/ThemeToggle";

/**
 * Providers — RootLayout 의 client component 경계.
 *
 * Spec reference: plan.md Phase 2 T024 + research.md §"React Query Provider"
 *
 * 역할:
 * - QueryProvider 주입 (React Query)
 * - useThemeEffect — preferences.theme 에 따라 :root.dark 클래스 toggle
 *
 * Root layout 은 server component 유지 → 본 wrapper 가 client boundary 담당.
 */
export function Providers({ children }: { children: ReactNode }) {
    useThemeEffect();
    return <QueryProvider>{children}</QueryProvider>;
}
