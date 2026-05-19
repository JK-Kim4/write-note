"use client";

import { useEffect } from "react";

/**
 * Service Worker 등록 — client component.
 *
 * 출처: node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md §2 (registerServiceWorker)
 * 본 PoC 는 push notification 미포함 — 단순 등록만 수행.
 *
 * 임시 — Phase 6 (Week 6) 6-4 진입 시 캐시 전략 + 업데이트 흐름 보강.
 */
export function SWRegister() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }
        navigator.serviceWorker
            .register("/sw.js", {
                scope: "/",
                updateViaCache: "none",
            })
            .then((reg) => {
                console.log("[SW] registered, scope:", reg.scope);
            })
            .catch((err: unknown) => {
                console.error("[SW] registration failed:", err);
            });
    }, []);

    return null;
}
