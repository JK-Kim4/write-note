/**
 * 온보딩 가이드 v2 — 단계 정의 + 핸드오프 키 상수.
 *
 * 순수 모듈(사이드이펙트 0, DOM/React 의존 없음) — OnboardingTour·LibraryOnboardingTour 공유.
 * driver.js DriveStep 타입 호환 구조(element 선택적·popover 필수).
 */

import { ONBOARDING_ILLUSTRATIONS, introCard } from "./onboardingIllustrations";

/** sessionStorage 핸드오프 키 — "더 보기" 시 set → /library 2차 투어 시작 시 제거(1회성). */
export const ONBOARDING_HANDOFF_KEY = "writenote.onboarding.stage.v1";

/** 핸드오프 값 */
export const ONBOARDING_STAGE_LIBRARY = "library";

/** 분기 라벨 */
export const LABEL_MORE = "더 보기";
export const LABEL_START = "바로 시작";

/**
 * 홈 1차 투어 단계 정의.
 *
 * step 1~3: 인트로 카드(element 없음 → 화면 중앙 popover).
 * step 4~6: 메뉴 스포트라이트(data-tour 마커 기준).
 * step 6은 분기 step — "더 보기"/"바로 시작" 로직은 OnboardingTour.tsx 에서 처리.
 */
export const HOME_TOUR_STEPS = [
    // 인트로 카드 3장 — element 없음(중앙 popover). 일러스트+제목+설명을 description(innerHTML)에 주입,
    // popoverClass="ob-intro" 로 globals.css 의 애니메이션/정지 스타일 스코프.
    {
        popover: {
            description: introCard(
                ONBOARDING_ILLUSTRATIONS.series,
                "시리즈를 만들 수 있어요",
                "소설비에서는 작품들을 하나의 시리즈로 묶어 관리할 수 있어요.",
            ),
            popoverClass: "ob-intro",
        },
    },
    {
        popover: {
            description: introCard(
                ONBOARDING_ILLUSTRATIONS.collect,
                "시리즈에 작품을 담을 수 있어요",
                "시리즈 안에 여러 작품(단편·중편·회차)을 넣거나, 독립 작품으로 따로 관리할 수 있어요.",
            ),
            popoverClass: "ob-intro",
        },
    },
    {
        popover: {
            description: introCard(
                ONBOARDING_ILLUSTRATIONS.export,
                "시리즈를 하나의 작품으로 내보낼 수 있어요",
                "완성된 시리즈는 PDF·DOCX·텍스트 파일로 한 번에 내보낼 수 있어요.",
            ),
            popoverClass: "ob-intro",
        },
    },
    // 메뉴 스포트라이트 3개
    {
        element: '[data-tour="nav-works"]',
        popover: {
            title: "작품",
            description: "내 작품 목록이에요. 시리즈와 작품을 여기서 만들고 관리해요.",
            side: "bottom" as const,
        },
    },
    {
        element: '[data-tour="nav-boards"]',
        popover: {
            title: "보드",
            description: "인물·사건·설정을 카드로 펼쳐 플롯을 설계해요. 작품·시리즈에 매달아 집필 중에도 참고할 수 있어요.",
            side: "bottom" as const,
        },
    },
] as const;

/**
 * 라이브러리 2차 투어 단계 정의.
 *
 * L1: 새 시리즈 버튼, L2: 새 작품 버튼 스포트라이트(설명형, 생성 강제 없음).
 */
export const LIBRARY_TOUR_STEPS = [
    {
        element: '[data-tour="new-series"]',
        popover: {
            title: "여기서 시리즈를 만들어요",
            description: "버튼을 눌러 시리즈를 만들고, 여러 작품을 하나로 묶어 보세요.",
            side: "bottom" as const,
        },
    },
    {
        element: '[data-tour="new-work-root"]',
        popover: {
            title: "여기서 작품을 만들어요",
            description: "버튼을 눌러 새 작품을 시작해 보세요. 나중에 시리즈로 옮길 수 있어요.",
            side: "top" as const,
        },
    },
] as const;
