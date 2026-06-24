---
description: "Task list for 마이페이지 계정 셸 재구성"
---

# Tasks: 마이페이지 계정 셸 재구성

**Input**: Design documents from `specs/037-mypage-account-shell/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함(CLAUDE.md TDD HARD-GATE).

**Organization**: US 단위 phase. 배포 묶음 = **R1(Foundational+US1+US2, FE 단독·BE 0) → R2(US3, BE passwordSet 선행→FE)**. 각 task 에 `[BE]`/`[FE]`.

## Path Conventions

- 프론트: `frontend/src/`
- 백엔드: `backend/src/main/kotlin/com/writenote/`, 테스트 `backend/src/test/...`

---

## Phase 1: Setup

- [X] T001 [P] [FE] `frontend/src/app/(main)/mypage/` 하위 섹션 디렉토리(profile·settings·connections·withdraw) 골격 준비 (이후 task 가 page 채움)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 섹션의 전제 — 사이드 메뉴 셸. 완료 전 어떤 섹션도 자리를 못 잡음.

- [X] T002 [FE] `MypageSidebar` 컴포넌트 — 섹션 메뉴(프로필·환경설정·문의·도움말·회원 탈퇴) 링크 + 현재 섹션 활성 강조 + 회원 탈퇴 맨 아래 위험 톤 분리. 계정 연결 항목은 US3에서 추가 `frontend/src/components/mypage/MypageSidebar.tsx`
- [X] T003 [FE] `MypageSidebar` RTL 테스트 — 메뉴 렌더·활성 강조·탈퇴 하단 분리 `frontend/src/components/mypage/MypageSidebar.test.tsx`
- [X] T004 [FE] `mypage/layout.tsx` 셸 — 좌 `MypageSidebar` + 우 `{children}` 2단 레이아웃 `frontend/src/app/(main)/mypage/layout.tsx`
- [X] T005 [FE] `mypage/page.tsx` → `/mypage/profile` 리다이렉트(Next redirect) `frontend/src/app/(main)/mypage/page.tsx`

**Checkpoint**: 셸·사이드 메뉴·기본 리다이렉트 준비 — 섹션 구현 가능.

---

## Phase 3: User Story 1 - 마이페이지 계정 셸(프로필·문의·탈퇴) (Priority: P1) 🎯 MVP

**Goal**: 프로필(닉네임+계정정보) + 문의 진입 + 회원 탈퇴(모달 보존)가 셸 안에서 동작. 딥링크·새로고침.

**Independent Test**: `/mypage/profile` 직접 접근·새로고침 시 닉네임·계정정보 표시, 회원 탈퇴 모달 동작, 문의 메뉴 → /contact.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] [FE] `WithdrawSection` RTL 테스트 — 확인 문구 미입력 시 비활성·정확 입력 시 활성(기존 settings 테스트 행위 보존) `frontend/src/components/mypage/WithdrawSection.test.tsx`

### Implementation for User Story 1

- [X] T007 [P] [US1] [FE] `profile/page.tsx` — 036 `NicknameSection`+`AccountInfoSection` 재사용(`["auth","me"]` 쿼리) `frontend/src/app/(main)/mypage/profile/page.tsx`
- [X] T008 [P] [US1] [FE] `WithdrawSection` 추출 — 기존 `settings/page.tsx` 의 탈퇴 모달·확인문구·handleWithdraw 로직 이동(동작 보존) `frontend/src/components/mypage/WithdrawSection.tsx`
- [X] T009 [US1] [FE] `withdraw/page.tsx` — `WithdrawSection` 결선 `frontend/src/app/(main)/mypage/withdraw/page.tsx`
- [X] T010 [US1] [FE] 문의 메뉴 — `MypageSidebar` 의 "문의·도움말" 항목이 `/contact` 로 이동(섹션 페이지 없이 링크) `frontend/src/components/mypage/MypageSidebar.tsx`

**Checkpoint**: 셸 + 프로필·문의·탈퇴 동작(계정 셸 골격 완성).

---

## Phase 4: User Story 2 - 환경설정 흡수 (Priority: P2)

**Goal**: 기존 `/settings`(테마·용지·목표) → 마이페이지 환경설정 섹션. `/settings` 리다이렉트 + 헤더 nav 정리.

**Independent Test**: `/mypage/settings` 에서 테마·용지·목표 변경 동작 보존, `/settings` 접근 시 리다이렉트, 헤더에 설정 중복 진입점 없음.

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] [FE] `PreferencesSections` RTL 테스트 — 일일 목표 select 7개·용지/테마 radiogroup 렌더(기존 settings 테스트 행위 보존) `frontend/src/components/mypage/PreferencesSections.test.tsx`

### Implementation for User Story 2

- [X] T012 [P] [US2] [FE] `PreferencesSections` 추출 — 기존 `settings/page.tsx` 의 테마·새 작품 기본 용지·일일 작업 목표 블록 이동(preferences 스토어 그대로) `frontend/src/components/mypage/PreferencesSections.tsx`
- [X] T013 [US2] [FE] `mypage/settings/page.tsx` — `PreferencesSections` 결선 `frontend/src/app/(main)/mypage/settings/page.tsx`
- [X] T014 [US2] [FE] 기존 `settings/page.tsx`·`settings/page.test.tsx` 제거 + 흡수된 테스트(탈퇴·일일목표·문의)를 마이페이지 섹션 테스트로 이관 확인 `frontend/src/app/(main)/settings/`
- [X] T015 [US2] [FE] `next.config.ts` redirects() 에 `/settings` → `/mypage/settings` 추가 `frontend/next.config.ts`
- [X] T016 [US2] [FE] `(main)/layout.tsx` NAV_ITEMS 에서 "설정" 제거(마이페이지 진입점 유지) `frontend/src/app/(main)/layout.tsx`
- [X] T017 [US2] [FE] `auth/link-success/page.tsx` 안내 목적지 `/settings` → `/mypage/connections` `frontend/src/app/auth/link-success/page.tsx`

**Checkpoint**: 환경설정 흡수 완료 — R1(US1+US2) FE 단독 배포 가능.

---

## Phase 5: User Story 3 - 계정 연결 (Priority: P3)

**Goal**: 연결 상태 표시 + 미연결 수단 연결. BE `passwordSet` additive 선행.

**Independent Test**: 계정 연결 섹션에서 이메일/카카오 연결 상태 정확, 미연결 수단만 액션, 비밀번호 추가·카카오 연결 시작.

### Implementation for User Story 3 — Backend (R2, 선행)

- [X] T018 [US3] [BE] `AuthMeResponse.passwordSet: Boolean` additive + `UserAuthConverter.toAuthMeResponse` 매핑(`passwordHash != null`) `backend/src/main/kotlin/com/writenote/model/response/AuthMeResponse.kt`, `backend/src/main/kotlin/com/writenote/components/UserAuthConverter.kt`
- [X] T019 [US3] [BE] `UserAuthConverter` 단위 테스트 — passwordHash 유무에 따른 passwordSet 매핑(기존 me 테스트 회귀 0) `backend/src/test/kotlin/com/writenote/components/UserAuthConverterTest.kt`

### Implementation for User Story 3 — Frontend (R2, BE 배포 후)

- [X] T020 [P] [US3] [FE] `types/api.ts` `AuthMeResponse` 에 `passwordSet: boolean` 추가 `frontend/src/types/api.ts`
- [X] T021 [P] [US3] [FE] `ConnectionsSection` RTL 테스트 — 이메일가입자(카카오 미연결)=카카오 연결 노출 / 카카오가입자(passwordSet=false)=비밀번호 추가 노출 / 둘다=액션 없음 `frontend/src/components/mypage/ConnectionsSection.test.tsx`
- [X] T022 [US3] [FE] `ConnectionsSection` — `kakaoLinked`·`passwordSet` 로 연결 상태 표시 + 비밀번호 추가 폼(POST `/api/auth/link/email`, 공용 client, PASSWORD_ALREADY_SET 처리) `frontend/src/components/mypage/ConnectionsSection.tsx`
- [X] T023 [US3] [FE] 카카오 추가 연결 시작 — POST `/api/auth/link/kakao`(공용 client) 후 `window.location` OAuth 진입. ⚠️ **R2 실측**(CSRF 헤더·session·302 처리, contracts/account-link-ui.md) `frontend/src/components/mypage/ConnectionsSection.tsx`
- [X] T024 [US3] [FE] `connections/page.tsx` 결선 + `MypageSidebar` 에 "계정 연결" 메뉴 항목 추가 `frontend/src/app/(main)/mypage/connections/page.tsx`, `frontend/src/components/mypage/MypageSidebar.tsx`

**Checkpoint**: 계정 연결 동작(비밀번호 추가 + 카카오 연결 시작 실측).

---

## Phase 6: Polish & Cross-Cutting

- [X] T025 [FE] R1 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN
- [X] T026 [BE] R2 BE 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN
- [ ] T027 dogfooding — quickstart.md S1~S4(셸 딥링크·환경설정 보존·탈퇴 모달·계정 연결 실측) 로컬 3종 기동 검증

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup → Foundational(셸/sidebar/리다이렉트) → US1/US2/US3**
- **US1·US2**: Foundational 후. FE 단독(BE 0). 서로 독립(다른 섹션 파일)
- **US3**: Foundational 후. BE T018(passwordSet) 선행 → FE T020+ 의존

### 배포 묶음 (방향 의존)

- **R1 (FE 단독, BE 0, 먼저)**: T001–T017 — 셸·프로필·문의·탈퇴·환경설정 흡수·리다이렉트·헤더 정리
- **R2 (BE passwordSet 선행 → FE)**: T018–T024 — 계정 연결
- R1 은 백엔드 계약 변경 0이라 FE 단독 배포 안전

### Within Each Story

- 테스트 먼저 → 컴포넌트 추출/신규 → 페이지 결선
- 같은 파일 수정(MypageSidebar T002/T010/T024, ConnectionsSection T022/T023, types/api T020) 순차

### Parallel Opportunities

- T007·T008 (profile·WithdrawSection, 다른 파일) 병렬
- T011·T012 (환경설정 테스트·추출) 병렬
- T020·T021 (types·ConnectionsSection 테스트) 병렬

---

## Implementation Strategy

### MVP (US1)

1. Setup → Foundational(셸/sidebar) → US1(프로필·문의·탈퇴)
2. **STOP & VALIDATE**: 셸 + 프로필 딥링크 + 탈퇴 보존
3. (US2까지 묶어) R1 FE 배포

### Incremental

1. Foundational + US1 + US2 → 계정 셸 + 환경설정 흡수(R1, FE 단독 배포)
2. US3 → 계정 연결(R2: BE passwordSet 선행 → FE)
3. dogfooding(T027) → develop merge

---

## Notes

- `[P]` = 다른 파일·선행 의존 없음
- FE 작성 직후 `pnpm build`(RSC 경계). 헤더/리다이렉트 변경은 build 로 검출
- `client.ts` 409 분기는 **error.code 기준** — `PASSWORD_ALREADY_SET` 는 일반 ApiError 흐름(code-quality §409)
- 카카오 연결 시작(T023)은 추측 금지 — R2 dogfooding 실측으로 확정(plan NEEDS CLARIFICATION)
- 기존 settings 테스트(탈퇴·일일목표·문의 행위)는 마이페이지 섹션 테스트로 이관(T014), 행위 보호 누락 없게
