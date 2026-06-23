---
description: "Task list — 온보딩 가이드 고도화 (v2)"
---

# Tasks: 온보딩 가이드 고도화 (최초 사용자 온보딩 투어 v2)

**Input**: Design documents from `specs/035-onboarding-guide-v2/`

**Tests**: 포함(CLAUDE.md TDD HARD-GATE §5). 시스템 경계(driver.js·next router·설정 HTTP client·sessionStorage)만 mock. 시각 스포트라이트·이동 타이밍은 dogfooding 게이트.

**Organization**: US1(P1, 홈 인트로+메뉴=MVP) / US2(P2, 더보기→라이브러리 가이드). **프론트엔드 단독·백엔드 0.**

**경로 규약**: `frontend/src/...`. 백엔드·마이그레이션·env 미접촉.

---

## Phase 1: Setup

- [ ] T001 [P] AGENTS.md 의무 — 구현 전 `frontend/node_modules/next/dist/docs/`의 navigation(`useRouter`/`router.push`)·`'use client'` 관련 가이드 정독(경로 존재 확인됨), 핵심을 구현에 반영

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 단계·문구·핸드오프 키 공유 정의. US1·US2 모두 의존. **⚠️ 완료 전 US 작업 불가.**

- [ ] T002 `onboardingSteps.ts` 신규 — 인트로 카드 3(시리즈 생성/작품 포함/단위 내보내기) + 메뉴 스포트라이트 3(작품 `[data-tour="nav-works"]`/메모 `nav-memos`/인물 `nav-characters`) step 정의(한국어 문구·타겟 셀렉터) + 핸드오프 키 상수 `writenote.onboarding.stage.v1` + 분기 라벨("더 보기"/"바로 시작"). 순수 모듈 in `frontend/src/components/onboarding/onboardingSteps.ts`

**Checkpoint**: 공유 정의 준비 → 스토리 진입 가능.

---

## Phase 3: User Story 1 - 홈에서 서비스 개념과 메뉴를 이해한다 (Priority: P1) 🎯 MVP

**Goal**: 신규 사용자가 홈에서 인트로 3카드 + 메뉴 3설명을 자동으로 안내받고, 완료/종료 시 다시 안 뜬다.

**Independent Test**: 온보딩 미완료로 홈 진입 → 인트로 3카드 → 작품·메모·인물 순 강조 → 끝내기/건너뛰기 시 종료·완료 저장 → 재진입 시 미시작.

### Tests for User Story 1 ⚠️ (먼저 작성, FAIL 확인)

- [ ] T003 [P] [US1] OnboardingTour 행위 테스트 — 미완료 시 자동 시작 / 완료 시 미시작 / 인트로→메뉴 순서 진행 / 모든 종료 경로(끝내기·건너뛰기·ESC·배경)에서 `putSettings({onboardingCompleted:"true"})` 1회 / "바로 시작"=종료 / "더 보기"=핸드오프 set + `router.push("/library")`. driver.js·`useRouter`·설정 client mock in `frontend/src/components/onboarding/OnboardingTour.test.tsx`

### Implementation for User Story 1

- [ ] T004 [US1] 작품 nav 링크에 `data-tour="nav-works"` 추가(기존 nav-memos/nav-characters 부착 패턴 답습, 속성만) in `frontend/src/app/(main)/layout.tsx`
- [ ] T005 [US1] `OnboardingTour.tsx` 재구성 — `onboardingSteps` 사용: 인트로 3 중앙 popover(element 없는 step) + 메뉴 3 스포트라이트, 완료 저장(메뉴 종료/모든 종료 경로), 분기 step6("바로 시작"=완료+종료 / "더 보기"=완료+핸드오프 set+`router.push("/library")`), driver 인스턴스·router·putSettings를 ref로 안정화(022 OOM 회귀 예방) in `frontend/src/components/onboarding/OnboardingTour.tsx` (T003 GREEN)

**Checkpoint**: US1 독립 동작 — 홈 인트로+메뉴+완료저장+바로시작. **첫 dogfooding 게이트**(quickstart 1~4,6,7,9).

---

## Phase 4: User Story 2 - 더 알고 싶은 작가는 시리즈·작품 만드는 법을 본다 (Priority: P2)

**Goal**: "더 보기" 선택 시 /library로 이동해 시리즈·작품 만들기 버튼을 순서대로 강조·설명(설명형).

**Independent Test**: "더 보기" 선택 → /library 이동 → 핸드오프 stage로 2차 투어 시작 → 시리즈 버튼 → 작품 버튼 강조, 타겟 준비 후 시작(빈 강조 없음). (US1의 "더 보기" 핸드오프 producer에 의존)

### Tests for User Story 2 ⚠️ (먼저 작성, FAIL 확인)

- [ ] T006 [P] [US2] LibraryOnboardingTour 행위 테스트 — `stage==="library"`면 시작 후 키 제거 / 없으면 미시작 / 타겟(`[data-tour="new-series"]`) 준비될 때까지 대기 후 시작 / 상한 도달 시 조용히 skip. driver.js·sessionStorage mock in `frontend/src/components/onboarding/LibraryOnboardingTour.test.tsx`

### Implementation for User Story 2

- [ ] T007 [P] [US2] `+새 시리즈`(L350 부근)·`+새 작품 시작하기`(L370 부근, 루트/미분류)에 `data-tour="new-series"`·`data-tour="new-work-root"` 추가(속성만, 동작 무변경) in `frontend/src/components/library/LibraryBoard.tsx`
- [ ] T008 [US2] `LibraryOnboardingTour.tsx` 신규 — `'use client'`, stage 읽어 타겟 DOM 준비 후 `driver().drive()`로 시리즈 버튼→작품 버튼 스포트라이트(설명형, "여기서 만들어요"), 시작 시 stage 키 제거, deps ref 안정 in `frontend/src/components/onboarding/LibraryOnboardingTour.tsx` (T006 GREEN)
- [ ] T009 [US2] `library/page.tsx`에 `LibraryOnboardingTour` 마운트(client 경계 — page가 server면 client 래퍼로 격리) in `frontend/src/app/(main)/library/page.tsx`

**Checkpoint**: US1+US2 동작 — 홈 가이드 + 더보기 라이브러리 가이드.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T010 [P] 한국어 문구·"시리즈" 용어 일관 점검(인트로 3·메뉴 3·라이브러리 2) in `frontend/src/components/onboarding/onboardingSteps.ts`
- [ ] T011 전체 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(RSC 경계는 build에서만 검출 — 포어그라운드, 결과 직접 확인)
- [ ] T012 [P] dogfooding — quickstart 9케이스(온보딩 리셋 → 인트로→메뉴→분기 양쪽→재진입 무재노출→이탈 내성). 인증 화면이라 §19 한계 인지, 메인루프/사용자 영역

---

## Dependencies & Execution Order

- **Setup(P1)** → **Foundational(P2, onboardingSteps)** → **US1(P3)** → **US2(P4)** → **Polish(P5)**.
- US2는 US1의 "더 보기" 핸드오프 producer(T005)에 의존(독립 테스트는 가능하나 실흐름은 US1 위에 얹힘).
- 핵심 간선: T005 ← T002·T003 / T008 ← T002·T006·T007 / T009 ← T008.

### TDD

- 각 스토리: 테스트(T003/T006) 먼저 → FAIL → 구현 GREEN. driver.js·router·sessionStorage·설정 client는 시스템 경계 mock. 시각/타이밍은 dogfooding.

### Parallel Opportunities

- Setup T001 단독. US1 테스트 T003 작성과 마커 T004는 병렬 가능(다른 파일). 단 T005는 T002·T003 후.
- US2: T006(테스트)·T007(마커)는 병렬, T008은 그 후, T009는 T008 후.

---

## Implementation Strategy

### MVP First (US1)

1. Setup(T001) → Foundational(T002) → US1(T003~T005).
2. **STOP & VALIDATE**: dogfooding 홈 흐름(인트로 3→메뉴 3→바로시작→재진입 무재노출). 기존 짧은 투어 대비 핵심 가치 달성.
3. 배포 가능(FE 단독) — 단 dogfooding 통과 후.

### Incremental

1. US1(홈 가이드 MVP) → US2(더보기 라이브러리 가이드) → Polish(게이트·문구·dogfooding 종합).
2. 각 스토리 독립 검증 후 진입(§10 핵심 우선 — 첫 dogfoodable=US1이 풍부한 홈 가이드를 직접 증명).

---

## Notes

- [P] = 다른 파일. 같은 파일(OnboardingTour) 작업은 순차.
- driver.js·router·sessionStorage·설정 client만 mock(시스템 경계), 오케스트레이션 로직은 호출/상태로 검증.
- 마커 추가는 **속성만**(클래스·핸들러·레이아웃 무변경) → 기존 동작 회귀 0(SC-006).
- 배포는 dogfooding 통과 후 별도(FE 단독 main push 자동배포). 백엔드·env·마이그레이션 0.
- frontend 명령은 `frontend/` cwd 고정. build/test 포어그라운드.
