# Implementation Plan: 온보딩 가이드 고도화 (최초 사용자 온보딩 투어 v2)

**Branch**: `035-onboarding-guide-v2` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/035-onboarding-guide-v2/spec.md`

## Summary

기존 027 온보딩 투어(홈 3단계 스포트라이트)를 **인트로 카드 3 + 메뉴 설명 3 + "더 보기" 분기 + (선택)라이브러리 시리즈/작품 가이드**로 고도화한다. driver.js 1.4.0 의 element 없는 중앙 popover(인트로 카드)·step별 콜백(분기)·프로그램 제어를 활용하고, 페이지 이동을 못 잇는 한계는 **세션 핸드오프 + /library 2차 투어**로 우회한다. 완료 저장은 인트로+메뉴 종료 시점(이탈 내성). **프론트엔드 단독·백엔드 0**(기존 `onboardingCompleted` 설정 재사용).

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Next.js 16.2.6 (App Router)

**Primary Dependencies**: driver.js **1.4.0**(이미 설치), React Query(설정 조회/PUT), 기존 `OnboardingTour`·설정 client. 신규 의존성 **0**.

**Storage**: 신규 0. 온보딩 완료 = 기존 사용자 설정 키 `onboardingCompleted`(서버 영속) 재사용. 멀티페이지 핸드오프 = 클라이언트 `sessionStorage`(임시, 영속 아님).

**Testing**: Vitest + RTL(행위 — 단계 전이·분기 라우팅·완료 저장 호출). 시스템 경계(driver.js·next router·설정 HTTP client)만 mock. RSC 경계 = `pnpm build`.

**Target Platform**: 웹(Vercel). 인증 영역(`(main)`).

**Project Type**: 웹 프론트엔드 단독(`frontend/`). 백엔드 미접촉.

**Performance Goals**: 가이드 즉시 렌더(체감 지연 없음). 2차 투어는 타겟 준비 후 시작(빈 강조/깜빡임 0).

**Constraints**: RSC 경계(client component 의무) / 커스텀 훅·effect deps 안정(무한 렌더 금지 — 022 OOM 회귀) / 멀티페이지 마운트 타이밍(타겟 존재 후 시작) / 모든 문구 한국어.

**Scale/Scope**: 신규 사용자 1회 가이드. 동시성 무관(단일 사용자 화면 흐름).

## Constitution Check

*GATE: Phase 0 이전 통과 필수, Phase 1 이후 재점검.*

`.specify/memory/constitution.md` = **빈 템플릿** → 프로젝트 정책상 **CLAUDE.md + `.claude/rules/*` 준용**.

| 게이트 | 평가 |
|---|---|
| **추측/단정 금지**(최우선) | PASS — 현재 027 구조·driver.js 1.4.0 능력·data-tour 마커·빈 /library 버튼 렌더 모두 실측. |
| **TDD HARD-GATE**(§5) | PASS(계획) — 단계 전이/분기 라우팅/완료 저장(putSettings) 호출/핸드오프 set·read 를 행위 테스트(RED→GREEN). driver.js 시각 스포트라이트는 dogfooding 게이트(자동 테스트 한계 명시). |
| **Mock 경계(Classist)** | PASS — driver.js(외부 라이브러리·DOM)·next router(네비)·설정 client(HTTP)만 mock. 투어 오케스트레이션 로직은 상태/호출로 검증. |
| **RSC 경계(HARD-GATE)** | 준수 — OnboardingTour·신규 LibraryOnboardingTour 모두 `'use client'`. `pnpm build` 로 검출. |
| **커스텀 훅 deps 안정**(022 OOM 회귀) | 준수 — effect/router/driver 인스턴스를 ref 로 안정화, 부모 setState effect 무한루프 회피. |
| **TS code-quality** | named export·`any` 금지·`type` 우선·`on*`/`handle*`·`enum` 회피. |
| **Surgical changes**(§3) | data-tour 마커는 3개 요소에만 추가(기존 동작 무변경), OnboardingTour 재구성 + 신규 1 컴포넌트. 인접 코드 미개선. |
| **frontend/AGENTS.md**(§5) | docs 경로 **존재 확인됨**(`node_modules/next/dist/docs/`) → 구현 시 관련 Next.js 16 가이드 정독(navigation/use client). |
| 신규 status/route/마이그레이션 | **0**(기존 페이지·설정 재사용). |

**판정: PASS** (위반 없음 → Complexity Tracking 불필요).

## Project Structure

### Documentation (this feature)

```text
specs/035-onboarding-guide-v2/
├── plan.md              # 본 파일
├── spec.md              # 완료
├── research.md          # Phase 0 — driver.js 멀티페이지·분기·카드 설계 결정
├── data-model.md        # Phase 1 — 신규 엔티티 0 + 투어 상태기계
├── quickstart.md        # Phase 1 — dogfooding·검증
├── contracts/
│   ├── tour-flow.md         # 단계 흐름·분기·완료 저장 계약(상태기계)
│   └── dom-markers.md       # data-tour 마커 + 핸드오프 키 계약
└── checklists/requirements.md
```

### Source Code — 신규/수정 (frontend only)

```text
frontend/src/
├── components/onboarding/
│   ├── OnboardingTour.tsx           # [수정] 단계 재구성: 인트로 3 중앙카드 + 메뉴 3 스포트라이트 + 분기('바로 시작'/'더 보기') + 완료 저장(메뉴 종료 시점)
│   ├── LibraryOnboardingTour.tsx    # [신규] /library 2차 투어(시리즈·작품 버튼 스포트라이트, 타겟 준비 후 시작)
│   ├── onboardingSteps.ts           # [신규] 단계·문구 정의(순수 — 인트로 카드/메뉴 step config) + 핸드오프 키 상수
│   └── OnboardingTour.test.tsx      # [수정] 단계 전이·분기·완료 저장 행위 테스트
├── app/(main)/
│   ├── layout.tsx                   # [수정] 작품 nav 링크에 data-tour="nav-works" 추가
│   └── library/page.tsx             # [수정] LibraryOnboardingTour 마운트(핸드오프 stage 읽어 시작)
└── components/library/
    └── LibraryBoard.tsx             # [수정] '+새 시리즈'(L350)·'+새 작품 시작하기'(L370)에 data-tour 추가
```

**Structure Decision**: 기존 `frontend/` 단일 앱. 온보딩 로직을 `components/onboarding/` 에 응집(단계 정의는 순수 모듈 `onboardingSteps.ts` 로 분리 — 테스트·재사용). 백엔드(`backend/`) 미접촉.

## 핵심 설계 결정 (research 요약 — 상세 = research.md)

- **인트로 카드**: driver.js `element` 생략 step → 화면 중앙 popover(카드). 3장 순차.
- **메뉴 스포트라이트**: 작품(신규 `data-tour="nav-works"`)·메모(`nav-memos` 기존)·인물(`nav-characters` 기존).
- **분기**: 메뉴 마지막(인물) step 의 popover 버튼을 "더 보기"/"바로 시작" 2지선다로 — `onNextClick`("더 보기"→핸드오프+`router.push('/library')`)·`onCloseClick`/done("바로 시작"→종료). `showButtons` 로 버튼 정돈.
- **완료 저장(FR-008)**: 인트로+메뉴 흐름이 끝나는(또는 그 전 종료) 시점에 `putSettings({onboardingCompleted:"true"})`. "더 보기" 로 라이브러리 가이드를 가더라도 **이미 완료 저장됨** → 이탈 내성.
- **멀티페이지 핸드오프**: "더 보기" 시 `sessionStorage["writenote.onboarding.stage.v1"]="library"` set → `/library` 도착 시 `LibraryOnboardingTour` 가 그 값 보고 시작, 시작 후 키 제거(1회성).
- **마운트 레이스(FR-011)**: 2차 투어는 `[data-tour="new-series"]`·`[data-tour="new-work-root"]` 타겟이 DOM 에 존재할 때까지 대기(폴링/`requestAnimationFrame` 또는 존재 확인 후 `driver().drive()`).
- **deps 안정**: driver 인스턴스·router·putSettings 를 ref 로 안정화(022 OOM 회귀 예방).

## 구현 라운드 (tasks 분해 가이드 — 핵심 우선 §10)

핵심 = "신규 사용자가 홈에서 서비스 개념+메뉴를 풍부하게 안내받고, 완료 후 안 뜬다". R1 이 이를 직접 충족(MVP).

- **R1 US1(홈 가이드, MVP)**: `onboardingSteps.ts`(인트로 3 + 메뉴 3 정의) + `OnboardingTour` 재구성(중앙 카드·스포트라이트·완료 저장) + 작품 nav `data-tour` 추가 + 분기 step UI("바로 시작"=종료 동작). 게이트: vitest(단계 전이·완료 저장 호출)·build. **첫 dogfooding**(홈 흐름).
- **R2 US2(더보기 → 라이브러리 가이드)**: 핸드오프(sessionStorage) + "더 보기"=set+navigate + `LibraryBoard` data-tour 2개 + `LibraryOnboardingTour`(타겟 준비 후 시작) + `library/page.tsx` 마운트. 게이트: vitest(분기 라우팅·핸드오프 set/read)·build. dogfooding(더보기 경로).
- **R3 Polish**: 전체 vitest·lint·typecheck·**build(RSC)**, 한국어 문구 점검, dogfooding 종합(인트로→메뉴→분기 양쪽→재진입 무재노출), 잔재 정리.

배포: **FE 단독**(main push 자동배포). **dogfooding 통과 후** 별도 배포(사용자 명시). 백엔드·env·마이그레이션 0.

## Complexity Tracking

> Constitution Check PASS — 위반 없음. 본 절 비움.
