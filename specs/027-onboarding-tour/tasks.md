# Tasks: 최초 사용자 온보딩 가이드 투어

**Feature**: 027-onboarding-tour | **Branch**: `027-onboarding-tour`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

테스트 포함(spec/plan 이 TDD HARD-GATE 를 명시). 각 user story 는 독립 테스트 가능.

## Phase 1: Setup

- [X] T001 driver.js 의존성 추가 — `cd frontend && pnpm add driver.js` (frontend/package.json·pnpm-lock 갱신)

## Phase 2: Foundational (blocking — 모든 user story 의 전제)

- [X] T002 [P] 백엔드 settings 허용 키 추가 — `backend/src/main/kotlin/com/writenote/service/SettingsService.kt` 의 `ALLOWED` 맵에 `"onboardingCompleted" to setOf("true")` 한 줄 추가
- [X] T003 [P] 백엔드 settings 키 검증 테스트 — `onboardingCompleted: "true"` 허용(저장→GET 포함) / `"false"` 거부(ValidationException) 케이스를 기존 settings 테스트 파일에 추가 (`backend/src/test/kotlin/com/writenote/...Settings*`)
- [X] T004 [P] 홈 "새 작품" 버튼에 표식 — `frontend/src/app/(main)/page.tsx` 의 `router.push("/library?new=1")` 버튼에 `data-tour="new-work"` 속성 추가(기능·스타일 무영향)
- [X] T005 [P] 네비 표식 3곳 — `frontend/src/app/(main)/layout.tsx` 의 "메모"(`/memos`)에 `data-tour="nav-memos"`, "인물"(`/characters`)에 `data-tour="nav-characters"`, "집필" 버튼에 `data-tour="nav-write"` 추가

## Phase 3: User Story 1 — 최초 사용자에게 4단계 가이드 노출 (P1) 🎯 MVP

**Goal**: 가이드를 본 적 없는 사용자가 홈 진입 시 driver.js 투어가 자동 시작되어 4핵심 요소를 순서대로 강조·설명.

**Independent Test**: `onboardingCompleted` 미저장 계정으로 홈 진입 → 가이드 자동 시작, 4단계 강조 후 정상 종료.

- [X] T006 [US1] OnboardingTour 시작 행위 테스트(RED) — `frontend/src/components/onboarding/OnboardingTour.test.tsx`: `GET /api/settings` 가 `onboardingCompleted` 키 없는 응답(msw) → driver `drive()` 가 호출된다. driver.js 는 `vi.mock("driver.js")` 로 시스템 경계 mock.
- [X] T007 [US1] OnboardingTour 구현(GREEN) — `frontend/src/components/onboarding/OnboardingTour.tsx` (`'use client'`): React Query `fetchSettings` 조회 → `onboardingCompleted` 부재 시 `useEffect` 안에서 `driver.js` 동적 import 후 4단계(`data-tour` 선택자, research R-1)로 `drive()`. `showProgress`, `nextBtnText="다음"`, `doneBtnText="시작하기"`. 중복 시작 `useRef` 가드. 렌더 출력 `null`.
- [X] T008 [US1] 홈에 마운트 — `frontend/src/app/(main)/page.tsx` 에 `<OnboardingTour />` 추가(작품 유무와 무관하게 마운트)

**Checkpoint**: 미완료 계정 홈 진입 시 투어가 뜨고 4단계가 순서대로 진행된다(영속 저장은 US2).

## Phase 4: User Story 2 — 한 번 본 사용자에겐 재노출 안 함 (P2)

**Goal**: 완료/건너뛰기 시 서버에 저장하고, 저장된 사용자(기기 무관)에겐 다시 안 띄움.

**Independent Test**: 완료 계정으로 재진입(같은/다른 기기) → 가이드 미노출.

- [X] T009 [US2] 영속 행위 테스트(RED) — `OnboardingTour.test.tsx` 에 추가: (a) `onboardingCompleted: "true"` 응답 → `drive()` 미호출, (b) driver `onDestroyed` 콜백 발화 → `PUT /api/settings { onboardingCompleted: "true" }`(`putSettings`) 호출.
- [X] T010 [US2] 영속·차단 구현(GREEN) — `OnboardingTour.tsx`: driver 설정의 `onDestroyed` 에서 `putSettings({ onboardingCompleted: "true" })` mutation 호출(실패는 로깅만, 비차단). 조회값이 `"true"` 면 시작 안 함. 조회 실패/로딩 시 시작 안 함(FR-007).

**Checkpoint**: 완료/건너뛴 사용자는 재진입 시 가이드가 뜨지 않는다.

## Phase 5: User Story 3 — 언제든 건너뛰기 (P3)

**Goal**: 어느 단계에서든 닫으면 즉시 종료되고 "이미 봤음"으로 저장.

**Independent Test**: 첫 단계에서 close/ESC → 즉시 종료, 재진입 미노출.

- [X] T011 [US3] 건너뛰기 행위 테스트 — `OnboardingTour.test.tsx` 에 추가: 첫 단계에서 close(→driver `onDestroyed` 수렴) → `putSettings({ onboardingCompleted: "true" })` 호출. 구현은 T010 의 `onDestroyed` 단일 경로로 커버됨을 확인(완료·건너뛰기 모두 동일 콜백).

**Checkpoint**: 건너뛰기도 완료와 동일하게 저장되어 재노출되지 않는다.

## Phase 6: Polish & Cross-Cutting

- [X] T012 [P] 프론트 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm vitest run && pnpm build` (RSC 경계 포함, 전 GREEN)
- [X] T013 [P] 백엔드 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- [ ] T014 Dogfooding — quickstart.md 7항목(최초 노출/단계 진행/완료 저장/건너뛰기/기기 무관 1회/모바일 네비/비차단) 실제 브라우저 확인
- [ ] T015 배포 — **BE 선행**(OCI: jar 교체 + `systemctl restart`, 키 허용 라이브) → **FE 후행**(`vercel --prod`). quickstart 배포 메모 준수

## Dependencies & 실행 순서

```
Setup(T001) → Foundational(T002-T005) → US1(T006-T008) → US2(T009-T010) → US3(T011) → Polish(T012-T015)
```

- **Foundational 차단**: T002(키 허용) 없이는 US2/US3 의 PUT 이 400. T004/T005(표식) 없이는 US1 강조 대상 부재.
- **US1 = MVP**: T001~T008 만으로 "최초 사용자에게 가이드가 뜬다"는 핵심 가치 단독 제공(영속 전이라 매 진입 노출되지만 동작은 완결).
- **US2/US3 는 같은 `onDestroyed` 경로** 를 공유 — T010 구현이 US3 까지 커버, T011 은 검증 테스트.

## 병렬 실행 기회

- Foundational: **T002·T003(백엔드) ∥ T004·T005(프론트 표식)** — 서로 다른 파일·레이어.
- Polish: **T012(FE 게이트) ∥ T013(BE 게이트)**.
- US 내부: 테스트(RED) → 구현(GREEN) 은 순차(같은 파일).

## Implementation Strategy

1. **MVP 먼저**: Phase 1~3(US1) 까지 — 가이드가 뜨는 것 자체를 먼저 dogfood.
2. **점진 추가**: US2(영속) → US3(건너뛰기 검증) 순으로 재노출 차단 완성.
3. **게이트 후 배포**: 전 게이트 GREEN + dogfooding 통과 후 BE→FE 순서 배포.
