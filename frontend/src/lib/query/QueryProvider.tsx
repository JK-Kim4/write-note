"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * React Query Provider — QueryClient 인스턴스를 root layout 에 주입.
 *
 * Spec reference: plan.md Phase 2 T013 + research.md §"React Query 5 + React 19"
 *
 * default options — 단일 사용자 집필 도구 특성에 맞춘 캐싱.
 * - staleTime 60s: 같은 데이터(작품/챕터 목록 등)를 1분 내 재진입 시 재요청 없이 캐시 즉시 서빙
 *   (집필실 재진입 지연 제거). 변경은 각 mutation 의 invalidateQueries 로 즉시 신선화하므로 안전.
 * - refetchOnWindowFocus false: 탭 포커스마다 일괄 재요청 방지(문서 쿼리는 이미 개별 비활성, 016).
 */

export function QueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60_000,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
