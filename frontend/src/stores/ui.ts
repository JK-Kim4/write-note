"use client";

import { create } from "zustand";

/**
 * Transient UI Store — 세션 범위 임시 상태. persist 없음.
 *
 * Spec reference: data-model.md §3
 */

interface UiState {
    sidePanelOpen: boolean;
    currentWritingScroll: number;
    setSidePanelOpen: (open: boolean) => void;
    setCurrentWritingScroll: (scroll: number) => void;
}

export const useUi = create<UiState>()((set) => ({
    sidePanelOpen: true,
    currentWritingScroll: 0,
    setSidePanelOpen: (sidePanelOpen) => set({ sidePanelOpen }),
    setCurrentWritingScroll: (currentWritingScroll) => set({ currentWritingScroll }),
}));
