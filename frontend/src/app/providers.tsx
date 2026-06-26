"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/QueryProvider";
import { useThemeEffect } from "@/components/theme/ThemeToggle";
import { PreferencesSync } from "@/components/PreferencesSync";

/**
 * Providers — RootLayout 의 client component 경계.
 *
 * 역할:
 * - QueryProvider 주입 (React Query)
 * - useThemeEffect — preferences.theme 에 따라 :root.dark 클래스 toggle
 *
 * 044 보드 중심 전환 — 전역 ⌘+N 빠른 메모 캡처(QuickCaptureModal) 폐기(메모 UI 통합).
 * Root layout 은 server component 유지 → 본 wrapper 가 client boundary 담당.
 */
export function Providers({ children }: { children: ReactNode }) {
    useThemeEffect();
    return (
        <QueryProvider>
            <PreferencesSync />
            {children}
        </QueryProvider>
    );
}
