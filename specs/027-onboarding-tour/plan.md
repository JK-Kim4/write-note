# Implementation Plan: 최초 사용자 온보딩 가이드 투어

**Branch**: `027-onboarding-tour` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/027-onboarding-tour/spec.md`

## Summary

최초 로그인 사용자가 홈(`/`)에 진입하면 driver.js 스포트라이트 가이드가 자동으로 떠
핵심 4요소(새 작품·메모·인물·집필)를 홈 한 화면에서 순서대로 강조·설명한다. 완료/건너뛰기
시 서버 `user_settings`의 `onboardingCompleted` 키에 영속 저장해 재노출을 막는다.
백엔드는 허용 키 한 줄 추가가 전부이고, 무게중심은 프론트엔드(가이드 컴포넌트 + 대상 표식)다.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19.2 / Next.js 16 (App Router) — 프론트 주. Kotlin 2.2 / Spring Boot 4 — 백엔드 1줄.

**Primary Dependencies**: `driver.js`(신규 FE 의존성, 가이드 투어), React Query(서버 상태), 기존 `settings` API(`@/lib/api/settings`).

**Storage**: 서버 `user_settings`(사용자별 key-value, 복합 PK userId+settingKey). 신규 키 `onboardingCompleted`(값 `"true"`만 허용). 스키마 변경·마이그레이션 0.

**Testing**: Vitest + React Testing Library + msw(FE 행위), JUnit5 + AssertJ(BE settings 키 검증). driver.js DOM은 시스템 경계로 mock.

**Target Platform**: Web — Vercel(FE) + OCI(BE), same-origin `/api/*` 프록시.

**Project Type**: Web application (frontend + backend).

**Performance Goals**: 가이드는 홈 진입 후 즉시 표시(설정 조회 1회), 4단계 30초 내 완주 가능(SC-003).

**Constraints**: 홈 단일 화면(라우팅 없음). driver.js는 client component에서 동적 import(SSR 회피). 설정 조회 실패 시 비표시(핵심 흐름 비차단, FR-007).

**Scale/Scope**: 단일 화면 4단계 투어. FE 신규 컴포넌트 1개 + 대상 4곳 `data-tour` 속성 + BE 1줄.

## Constitution Check

*프로젝트 constitution.md 는 미작성 템플릿이므로, 프로젝트 룰(CLAUDE.md / `.claude/rules`)을 게이트로 적용.*

- **TDD HARD-GATE (Red-Green-Refactor)**: BE 설정 키 검증 테스트 + FE `OnboardingTour` 행위 테스트(미완료→시작 / 완료→미시작 / 스킵→저장)를 구현 전 RED 로 작성. ✅ 계획 반영
- **단순성(YAGNI)**: 경량 driver.js, 백엔드 1줄, "다시 보기" v1 제외. 신규 추상화·설정 옵션 없음. ✅
- **Surgical changes**: 대상 컴포넌트엔 `data-tour` 속성만 추가(기능·스타일 무영향), settings `ALLOWED`에 1줄. 인접 코드 미수정. ✅
- **Mock 경계(Classist)**: FE 는 HTTP(msw)·driver.js DOM(시스템 경계)만 mock, 내부 collaborator 미mock. BE 는 SettingsService 단위 테스트(기존 패턴). ✅
- **공용 fetch 래퍼 status 분기**: 신규 status 분기 없음(기존 settings GET/PUT 재사용). ✅
- **RSC 경계(Next 16)**: `OnboardingTour`는 `'use client'`(useEffect/driver.js/React Query 사용). 작성 직후 `pnpm build` 로 경계 검증. ✅

**게이트 통과** — 위반 없음. Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/027-onboarding-tour/
├── plan.md              # This file
├── research.md          # Phase 0 — driver.js 통합·설정 키 패턴
├── data-model.md        # Phase 1 — onboardingCompleted 설정 키
├── quickstart.md        # Phase 1 — dogfooding 검증 흐름
├── contracts/
│   ├── settings-onboarding.md   # GET/PUT /api/settings 의 onboardingCompleted 키 계약
│   └── onboarding-tour-ui.md    # OnboardingTour 컴포넌트 + data-tour 표식 계약
└── tasks.md             # /speckit-tasks 산출 (본 명령 아님)
```

### Source Code (repository root)

```text
backend/
└── src/main/kotlin/com/writenote/service/SettingsService.kt   # ALLOWED 에 onboardingCompleted 1줄
    src/test/kotlin/com/writenote/service/SettingsService*     # 키 허용/거부 테스트

frontend/
├── src/components/onboarding/OnboardingTour.tsx               # 신규 — 가이드 컴포넌트('use client')
│   src/components/onboarding/OnboardingTour.test.tsx          # 신규 — 행위 테스트
├── src/lib/api/settings.ts                                    # onboardingCompleted read/update 헬퍼(필요 시)
├── src/app/(main)/page.tsx                                    # 홈 — OnboardingTour 마운트 + "새 작품"에 data-tour
└── src/app/(main)/layout.tsx                                  # 네비 메모/인물/집필에 data-tour
```

**Structure Decision**: 기존 web app 구조(`backend/` + `frontend/`) 그대로. 신규 코드는 `frontend/src/components/onboarding/`에 격리(단일 책임). 백엔드는 기존 `SettingsService` 1줄 확장.

## Complexity Tracking

> Constitution Check 위반 없음 — 비움.
