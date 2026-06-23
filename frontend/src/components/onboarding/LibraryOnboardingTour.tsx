"use client";

import "driver.js/dist/driver.css";
import { useEffect, useRef, useState } from "react";
import {
    LIBRARY_TOUR_STEPS,
    ONBOARDING_HANDOFF_KEY,
    ONBOARDING_STAGE_LIBRARY,
} from "./onboardingSteps";
import { OnboardingCelebration } from "./OnboardingCelebration";

/**
 * 라이브러리(/library) 2차 온보딩 투어 (035 US2).
 *
 * "더 보기" 분기에서 핸드오프된 사용자에게 시리즈·작품 버튼을 순서대로 강조·설명(설명형, 생성 강제 없음).
 * 마지막 step 완료 시 OnboardingCelebration 표시.
 *
 * 시작 조건:
 *   - sessionStorage["writenote.onboarding.stage.v1"] === "library"
 *   - 타겟 DOM([data-tour="new-series"], [data-tour="new-work-root"]) 존재
 *
 * 시작 직후 핸드오프 키를 즉시 제거(1회성 — 새로고침 재발 방지).
 * 타겟이 준비될 때까지 폴링(50ms 간격, 최대 2000ms). 상한 도달 시 조용히 skip.
 *
 * 완료 감지:
 *   - 마지막 step에서 onNextClick 발화 후 onDestroyed = 정상 완료 → 축하
 *   - onCloseClick(×) 또는 onNextClick 없이 onDestroyed = 중도 이탈 → 축하 없음
 *
 * deps 안정: driver 동적 import 는 ref 로 취소 처리, 폴링 타이머는 cleanup 에서 제거.
 */

const POLL_INTERVAL_MS = 50;
const POLL_MAX_MS = 2000;

export function LibraryOnboardingTour() {
    const startedRef = useRef(false);
    const lastStepReachedRef = useRef(false); // 마지막 step 완료 감지
    const [showCelebration, setShowCelebration] = useState(false);

    useEffect(() => {
        if (startedRef.current) return;

        // 핸드오프 키 확인
        const stage = sessionStorage.getItem(ONBOARDING_HANDOFF_KEY);
        if (stage !== ONBOARDING_STAGE_LIBRARY) return;

        // 타겟 DOM 준비 대기 폴링
        let elapsed = 0;
        let cancelled = false;
        let timerId: ReturnType<typeof setInterval> | null = null;

        function tryStart() {
            if (cancelled) return;
            const seriesTarget = document.querySelector('[data-tour="new-series"]');
            const workTarget = document.querySelector('[data-tour="new-work-root"]');
            if (!seriesTarget || !workTarget) return; // 아직 준비 안 됨

            // 타겟 준비됨 — 폴링 중지 + 핸드오프 키 제거 + 투어 시작
            if (timerId !== null) clearInterval(timerId);
            startedRef.current = true;
            sessionStorage.removeItem(ONBOARDING_HANDOFF_KEY);

            void (async () => {
                if (cancelled) return;
                const { driver } = await import("driver.js");
                if (cancelled) return;

                // LIBRARY_TOUR_STEPS 는 readonly — 복사 후 전달
                // 마지막 step에 onNextClick 주입해 완료 플래그 감지
                const steps = LIBRARY_TOUR_STEPS.map((step, idx) => {
                    const isLast = idx === LIBRARY_TOUR_STEPS.length - 1;
                    return {
                        ...step,
                        popover: isLast
                            ? {
                                ...step.popover,
                                onNextClick: () => {
                                    // 마지막 step 완료 버튼(확인) 클릭 — 완료 플래그 set
                                    lastStepReachedRef.current = true;
                                    driverInstance.destroy();
                                },
                            }
                            : { ...step.popover },
                    };
                });

                const driverInstance = driver({
                    showProgress: false,
                    showButtons: ["next", "close"],
                    nextBtnText: "다음",
                    doneBtnText: "확인",
                    steps,
                    onCloseClick: () => {
                        // × 클릭 = 중도 이탈 — 완료 플래그 reset
                        lastStepReachedRef.current = false;
                        driverInstance.destroy();
                    },
                    onDestroyed: () => {
                        // 모든 종료 경로 수렴 — 완료 플래그가 true면 축하
                        if (lastStepReachedRef.current) {
                            setShowCelebration(true);
                        }
                    },
                });

                driverInstance.drive();
            })();
        }

        // 즉시 1회 시도
        tryStart();
        if (startedRef.current) return;

        // 타겟 없으면 폴링
        timerId = setInterval(() => {
            elapsed += POLL_INTERVAL_MS;
            if (elapsed >= POLL_MAX_MS) {
                // 상한 도달 → 조용히 skip
                if (timerId !== null) clearInterval(timerId);
                return;
            }
            tryStart();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (timerId !== null) clearInterval(timerId);
        };
    }, []); // 마운트 1회만 실행

    if (showCelebration) {
        return <OnboardingCelebration onDone={() => setShowCelebration(false)} />;
    }
    return null;
}
