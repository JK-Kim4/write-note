"use client";

import "driver.js/dist/driver.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, putSettings, type SettingsMap } from "@/lib/api/settings";
import {
    HOME_TOUR_STEPS,
    LABEL_MORE,
    LABEL_START,
    ONBOARDING_HANDOFF_KEY,
    ONBOARDING_STAGE_LIBRARY,
} from "./onboardingSteps";
import { OnboardingCelebration } from "./OnboardingCelebration";

/**
 * 최초 사용자 온보딩 가이드 투어 v2 (035).
 *
 * 홈에 마운트. 설정 `onboardingCompleted` 가 미저장이면 driver.js 투어를 1회 시작.
 *
 * 단계:
 *   - 인트로 카드 3장(element 없음 = 화면 중앙 popover) — 시리즈/작품/내보내기 소개
 *   - 메뉴 스포트라이트 2개(작품→보드) — 044 보드 중심 전환(메모·인물 메뉴 폐기)
 *   - 마지막 step(보드)에 분기 2지선다:
 *       "바로 시작" → 완료 저장 + 투어 종료 + 축하 애니메이션
 *       "더 보기"   → 완료 저장 + sessionStorage 핸드오프 set + /library 이동
 *
 * 완료 저장(이탈 내성):
 *   - 끝내기/건너뛰기/ESC/배경(onDestroyed) 시에도 1회 저장
 *   - "더 보기" 분기 진입 전에 이미 저장됨 → 라이브러리 가이드 이탈해도 재노출 없음
 *
 * deps 안정: driver 인스턴스·router·putSettings·queryClient 를 ref 로 잡음(022 OOM 회귀 예방).
 */

export function OnboardingTour() {
    const startedRef = useRef(false);
    const savedRef = useRef(false); // 완료 저장 중복 방지
    const queryClient = useQueryClient();
    const router = useRouter();
    const [showCelebration, setShowCelebration] = useState(false);

    // ref 로 안정화 — effect deps 에 직접 넣지 않는다(022 무한렌더 회귀 예방).
    const routerRef = useRef(router);
    const queryClientRef = useRef(queryClient);
    const setShowCelebrationRef = useRef(setShowCelebration);
    useEffect(() => { routerRef.current = router; }, [router]);
    useEffect(() => { queryClientRef.current = queryClient; }, [queryClient]);

    const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

    // settings 를 ref 에도 보관(콜백 내부에서 최신값 접근 시 클로저 캡처 회피)
    const settingsRef = useRef(settings);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    useEffect(() => {
        if (startedRef.current) return;
        if (!settings) return;
        if (settings.onboardingCompleted === "true") return;
        startedRef.current = true;

        /** 완료 저장 — 1회만(중복 방지). */
        function saveCompleted() {
            if (savedRef.current) return;
            savedRef.current = true;
            void putSettings({ onboardingCompleted: "true" }).catch(() => {});
            queryClientRef.current.setQueryData<SettingsMap>(["settings"], (prev) => ({
                ...(prev ?? {}),
                onboardingCompleted: "true",
            }));
        }

        let cancelled = false;
        void (async () => {
            const { driver } = await import("driver.js");
            if (cancelled) return;

            // HOME_TOUR_STEPS 는 readonly — 드라이버에 전달할 mutable 복사본 생성.
            // 마지막 step(보드)에 분기 콜백 주입.
            const steps = HOME_TOUR_STEPS.map((step, idx) => {
                if (idx !== HOME_TOUR_STEPS.length - 1) return { ...step };
                // step 6: 분기 popover — 명시적 2지선다 버튼.
                // [바로 시작] = previous 슬롯(뒤로 가지 않고 완료+종료+축하), [더 보기] = next 슬롯.
                // (driver 는 마지막 step 에서 next 텍스트로 doneBtnText 대신 nextBtnText 를 쓰므로 둘 다 명시)
                return {
                    ...step,
                    popover: {
                        ...step.popover,
                        showButtons: ["previous", "next"] as ("previous" | "next")[],
                        prevBtnText: LABEL_START,
                        nextBtnText: LABEL_MORE,
                        onPrevClick: () => {
                            // "바로 시작" — 완료 저장 + 종료 + 축하 애니메이션. movePrevious 호출하지 않음.
                            saveCompleted();
                            driverInstance.destroy();
                            setShowCelebrationRef.current(true);
                        },
                        onNextClick: () => {
                            // "더 보기" — 완료 저장 + 핸드오프 set + 라이브러리 이동 (축하 없음)
                            saveCompleted();
                            sessionStorage.setItem(ONBOARDING_HANDOFF_KEY, ONBOARDING_STAGE_LIBRARY);
                            driverInstance.destroy();
                            routerRef.current.push("/library");
                        },
                    },
                };
            });

            // 전역: 인트로·메뉴(step 1~5)는 [다음]+[×]. step 6 분기는 위에서 [바로 시작]/[더 보기]로 override.
            // onCloseClick(×)·ESC·배경 = 모든 단계 공통 종료 → 완료 저장 후 종료(onDestroyed 수렴). 축하 없음.
            const driverInstance = driver({
                showProgress: false,
                showButtons: ["next"], // × 닫기 버튼 제거(사용자 요청). ESC/배경 클릭으로는 종료 가능(allowClose 기본).
                nextBtnText: "다음",
                steps,
                onCloseClick: () => {
                    // "닫기"(×)·ESC·배경 클릭 → 완료 저장 후 driver 종료. 축하 없음.
                    saveCompleted();
                    driverInstance.destroy();
                },
                onDestroyed: () => {
                    // 어느 종료 경로든 수렴(완료·건너뛰기·프로그램 destroy 포함).
                    saveCompleted();
                },
            });

            driverInstance.drive();
        })();

        return () => {
            cancelled = true;
        };
    }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps
    // router·queryClient 는 ref 로 안정화돼 deps 불필요.

    if (showCelebration) {
        return <OnboardingCelebration onDone={() => setShowCelebration(false)} />;
    }
    return null;
}
