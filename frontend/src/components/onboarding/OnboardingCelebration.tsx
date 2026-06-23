"use client";

import { useEffect, useRef } from "react";

/** 온보딩 완료 축하 오버레이 — 시안 E (대형 씰 슬램).
 *
 * 전체 화면 오버레이로 1회 재생 후 자동 fade-out(2400ms).
 * ESC 키 또는 클릭으로 즉시 종료.
 * prefers-reduced-motion: reduce 시 애니메이션 없이 씰+헤드라인만 렌더.
 */
export function OnboardingCelebration({ onDone }: { onDone: () => void }) {
    const onDoneRef = useRef(onDone);
    useEffect(() => {
        onDoneRef.current = onDone;
    }, [onDone]);

    // prefers-reduced-motion 감지
    const isReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    useEffect(() => {
        // 자동 dismiss 타이머
        const timer = setTimeout(() => {
            onDoneRef.current();
        }, 2400);

        // ESC 키 핸들러
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                onDoneRef.current();
            }
        }
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <div
            role="status"
            aria-live="polite"
            onClick={onDone}
            className={`ob-celebrate${isReduced ? "" : " ob-celebrate--animated"}`}
        >
            <div className="ob-celebrate__stage">
                <div className="ob-celebrate__center">
                    {/* 충격파 */}
                    <div className="ob-celebrate__shock" />
                    {/* 잉크 방울 */}
                    <div className="ob-celebrate__ink" style={{ "--tx": "-64px", "--ty": "-40px" } as React.CSSProperties} />
                    <div className="ob-celebrate__ink" style={{ "--tx": "60px", "--ty": "-46px" } as React.CSSProperties} />
                    <div className="ob-celebrate__ink" style={{ "--tx": "-72px", "--ty": "30px" } as React.CSSProperties} />
                    <div className="ob-celebrate__ink" style={{ "--tx": "68px", "--ty": "34px" } as React.CSSProperties} />
                    <div className="ob-celebrate__ink" style={{ "--tx": "0", "--ty": "-72px" } as React.CSSProperties} />
                    <div className="ob-celebrate__ink" style={{ "--tx": "-20px", "--ty": "64px" } as React.CSSProperties} />
                    {/* 씰 */}
                    <div className="ob-celebrate__seal" aria-hidden="true">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="#fff"
                                d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                            />
                        </svg>
                    </div>
                    {/* confetti */}
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "-120px", "--ty": "-70px", "--r": "40deg", "--d": ".3s", "--bg": "var(--w-accent, #a8542e)" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "120px", "--ty": "-66px", "--r": "-50deg", "--d": ".34s", "--bg": "#d48d62" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "-150px", "--ty": "-20px", "--r": "90deg", "--d": ".38s", "--bg": "#76753f" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "150px", "--ty": "-26px", "--r": "-80deg", "--d": ".32s", "--bg": "#f6e3d6" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "-70px", "--ty": "-90px", "--r": "160deg", "--d": ".42s", "--bg": "#d48d62" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "80px", "--ty": "-92px", "--r": "-30deg", "--d": ".36s", "--bg": "var(--w-accent, #a8542e)" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "-40px", "--ty": "-100px", "--r": "60deg", "--d": ".46s", "--bg": "#76753f" } as React.CSSProperties}
                    />
                    <div
                        className="ob-celebrate__confetti"
                        style={{ "--tx": "44px", "--ty": "-100px", "--r": "-120deg", "--d": ".4s", "--bg": "#f6e3d6" } as React.CSSProperties}
                    />
                </div>
                <div className="ob-celebrate__headline">
                    <strong>작업실이 준비됐어요</strong>
                    <span>이제 첫 작품을 시작해 보세요.</span>
                </div>
            </div>
        </div>
    );
}
