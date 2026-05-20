"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Auth Session Placeholder Store — Phase 1A 의 임시 X-User-Id 메커니즘과 정합.
 *
 * Spec reference: data-model.md §2 + spec.md §FR-009/010, contracts/api-client.md §2-1
 *
 * 임시 — Week 1B-1~2 진입 시 JWT cookie 기반 세션으로 swap. 본 store 폐기.
 * 영속 mechanism: localStorage key `writenote.auth.placeholder.v1`
 */

interface AuthPlaceholderState {
    userId: string | null;
    setUserId: (userId: string | null) => void;
    clear: () => void;
}

export const useAuthPlaceholder = create<AuthPlaceholderState>()(
    persist(
        (set) => ({
            userId: null,
            setUserId: (userId) => set({ userId: userId && userId.length > 0 ? userId : null }),
            clear: () => set({ userId: null }),
        }),
        {
            name: "writenote.auth.placeholder.v1",
        },
    ),
);
