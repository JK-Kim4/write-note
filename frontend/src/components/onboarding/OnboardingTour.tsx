"use client";

import "driver.js/dist/driver.css";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings, putSettings } from "@/lib/api/settings";

/**
 * 최초 사용자 온보딩 가이드 투어 (027).
 *
 * 홈에 마운트. 설정 `onboardingCompleted` 가 미저장이면 driver.js 스포트라이트 투어를 1회 시작.
 * 완료("시작하기")·건너뛰기(close/ESC/배경) 모두 driver 의 `onDestroyed` 로 수렴 → 서버에 영속 저장.
 * 조회 실패/로딩 시엔 시작하지 않는다(핵심 흐름 비차단, FR-007).
 *
 * driver.js JS 는 useEffect 안에서 동적 import(SSR/DOM 회피). 완료 저장은 `putSettings` 직접 호출
 * (React Query 반환 객체를 effect deps 로 잡지 않아 무한 렌더 회귀 회피 — code-quality.md).
 */

const TOUR_STEPS = [
    {
        element: '[data-tour="new-work"]',
        popover: { title: "새 작품", description: "여기서 첫 작품을 시작해요", side: "bottom", align: "start" },
    },
    {
        element: '[data-tour="nav-memos"]',
        popover: { title: "메모", description: "떠오른 아이디어를 곁쪽지로 남겨요", side: "bottom" },
    },
    {
        element: '[data-tour="nav-characters"]',
        popover: { title: "인물", description: "등장인물을 한곳에 정리해요", side: "bottom" },
    },
    {
        element: '[data-tour="nav-write"]',
        popover: { title: "집필", description: "작품으로 들어가 이어 써요", side: "bottom" },
    },
] as const;

export function OnboardingTour() {
    const startedRef = useRef(false);
    const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

    useEffect(() => {
        if (startedRef.current) return; // 중복 시작 가드
        if (!settings) return; // 로딩/조회 실패 → 미시작(비차단)
        if (settings.onboardingCompleted === "true") return; // 이미 봄 → 미시작
        startedRef.current = true;

        let cancelled = false;
        void (async () => {
            const { driver } = await import("driver.js");
            if (cancelled) return;
            driver({
                showProgress: true,
                showButtons: ["next", "close"],
                nextBtnText: "다음",
                doneBtnText: "시작하기",
                steps: [...TOUR_STEPS],
                onDestroyed: () => {
                    // 완료·건너뛰기 모두 여기로 수렴. 저장 실패는 사용자 동작 비차단(다음 진입 재시도).
                    void putSettings({ onboardingCompleted: "true" }).catch(() => {});
                },
            }).drive();
        })();

        return () => {
            cancelled = true;
        };
    }, [settings]);

    return null;
}
