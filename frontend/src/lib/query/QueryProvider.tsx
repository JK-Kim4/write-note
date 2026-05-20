"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * React Query Provider — QueryClient 인스턴스를 root layout 에 주입.
 *
 * Spec reference: plan.md Phase 2 T013 + research.md §"React Query 5 + React 19"
 *
 * 본 spec 시점의 default options 는 placeholder. Week 2 에서 staleTime / gcTime 조정.
 */

export function QueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
