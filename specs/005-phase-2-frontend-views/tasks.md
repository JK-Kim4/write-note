---
description: "Task list — 005 Phase 2 Frontend Views & Auth Integration"
---

# Tasks: 005 Phase 2 Frontend Views & Auth Integration

**Input**: Design documents from `/specs/005-phase-2-frontend-views/`

**Prerequisites**: [plan.md](./plan.md) / [spec.md](./spec.md) / [research.md](./research.md) / [data-model.md](./data-model.md) / [contracts/](./contracts/) / [quickstart.md](./quickstart.md)

**Tests**: 본 프로젝트는 TDD HARD-GATE(`~/.claude/rules/shared/testing-strategy.md` + plan Constitution Check). 로직(쿠키 인증 분기 / 401 refresh / 매핑·상태전이)은 테스트 task 포함(RED→GREEN). 정적 외관·라우트 골격·타입 선언은 TDD 완화(§5-5).

**Organization**: User Story 우선순위(P1~P6 = plan 라운드 R2~R7)별 phase. Foundational(Phase 2)=R1 인증 쿠키 전환(모든 US 전제).

## Format: `[ID] [P?] [Story] Description (file path)`

- **[P]**: 병렬 가능(다른 파일, 미완 의존 없음)
- **[Story]**: US1~US6 (Setup/Foundational/Polish 는 라벨 없음)

## Path Conventions

- frontend: `frontend/src/...`, `frontend/next.config.ts`, `frontend/package.json`
- backend: `backend/src/main/kotlin/com/writenote/...`, `backend/src/test/kotlin/com/writenote/...`

---

## ⚠️ 정합성 메모 (tasks 작성 시점 실측 — `agent-workflow-discipline §6`)

- **frontend 테스트 인프라 부재**: `vitest`/`@testing-library`/`msw` 미설치, 테스트 파일 0건, `package.json` scripts 에 `test`·`typecheck` 없음. plan 의 "pnpm test/typecheck" 게이트는 **Setup(T002~T004)에서 구축 후** 유효.
- **`JwtAuthenticationFilterTest.kt` 부재**: plan 이 "확장" 추측했으나 실제 없음. JWT 필터는 `JwtTokenProviderTest`(토큰 로직) + `AuthControllerWebTest`/`ProjectControllerIT`(Bearer 통합)로 커버. 쿠키 read 테스트는 **신규 생성**(T007).
- **003 Bearer 사용 테스트**(헤더 병존이 회귀 안 깨도록 GREEN 유지 대상): `AuthControllerWebTest` / `AuthOauthCallbackWebTest` / `ProjectControllerIT` / `CharacterControllerIT` / `ProjectControllerOwnerCleanupTest` / `AccountLinkWebTest`.
- **`OAuth2SuccessHandlerTest.kt` 존재**: 카카오 콜백 쿠키 전환 시 확장(T011).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 003 회귀 보존 확인 + frontend 테스트/검증 인프라 구축

- [X] T001 003 인증 테스트 시그니처 확인 — 기준선 확정: `AuthControllerWebTest` / `AuthOauthCallbackWebTest` / `ProjectControllerIT` / `CharacterControllerIT` / `ProjectControllerOwnerCleanupTest` / `AccountLinkWebTest` / `KakaoOAuth2UserServiceTest` 가 Bearer/헤더 사용 → 쿠키 병존(R-3) 시 GREEN 유지 대상
- [X] T002 frontend 테스트 의존성 설치 — `vitest@^3.2.4` + `vite@^5.4.21` + `@vitejs/plugin-react@^4.7.0` + `@testing-library/{react,jest-dom,user-event}` + `jsdom@^29` + `msw@^2.14`. **정정**: vitest 4(rolldown)는 `node:util.styleText` 요구 → Node v20.10.0 비호환. vite 7은 Node 20.19+ 요구. Node 20.10 호환 위해 vite5+vitest3+plugin-react4 고정(회고 후보)
- [X] T003 [P] vitest 설정 — `frontend/vitest.config.ts`(jsdom + alias `@/` + passWithNoTests) + `frontend/src/test/setup.ts`(jest-dom + msw lifecycle) + `frontend/src/test/msw/server.ts`
- [X] T004 [P] `frontend/package.json` scripts 추가 — `"test": "vitest run"` / `"typecheck": "tsc --noEmit"`. Checkpoint 통과: typecheck GREEN + test 실행 가능

**Checkpoint**: `cd frontend && pnpm typecheck && pnpm test` 실행 가능(현재 불가 → 가능으로 전환)

---

## Phase 2: Foundational — R1 인증 쿠키 전환 (Blocking Prerequisites)

**Purpose**: 헤더 인증 → httpOnly 쿠키 전환(backend) + same-origin 프록시 + client swap(frontend). **모든 US 의 전제**(쿠키 세션 없이는 데이터 화면 401).

**⚠️ CRITICAL**: 본 phase 완료 전 어떤 US 도 시작 불가. 003 헤더 회귀 GREEN 유지(R-3 병존).

### Backend — 쿠키 발급·인증

- [X] T005 [P] `AuthCookieFactory` 신설 — `backend/src/main/kotlin/com/writenote/auth/AuthCookieFactory.kt`. `ResponseCookie` 로 access/refresh 발급(HttpOnly+SameSite=Lax+Path=/+Secure(env)+Max-Age) + 만료(Max-Age=0) helper. `app.cookie.secure` env 추가(`application-*.yml`). (research R-2)
- [X] T006 [P] `AuthCookieFactory` 단위 테스트 — `backend/src/test/kotlin/com/writenote/auth/AuthCookieFactoryTest.kt`. access/refresh 쿠키 속성 + 만료 쿠키 검증 (RED→GREEN)
- [X] T007 `JwtAuthenticationFilter` 쿠키 read 병존 — `backend/.../auth/JwtAuthenticationFilter.kt`. 헤더(`Bearer eyJ`) 우선, 부재 시 `access_token` 쿠키 read, 둘 다 부재 pass-through. (research R-3, contracts/auth-cookie-contract.md §2)
- [X] T008 `JwtAuthenticationFilterTest` 신규 — `backend/.../auth/JwtAuthenticationFilterTest.kt`. (a) 헤더 케이스 (b) 쿠키 케이스 (c) 헤더 우선 (d) 둘 다 부재 pass-through (e) 무효 토큰 401. (RED→GREEN, 신규 — plan 추측 정정)
- [X] T009 `AuthController` login/refresh Set-Cookie + logout 만료 — `backend/.../controller/AuthController.kt`. `ResponseEntity` 에 `AuthCookieFactory` 발급 쿠키 헤더 추가. body `TokenPairResponse` 유지(003 호환). (research R-4)
- [X] T010 `AuthControllerWebTest` 쿠키 케이스 추가 — `backend/.../controller/AuthControllerWebTest.kt`. login/refresh Set-Cookie 검증 + logout Max-Age=0 + **003 body 케이스 GREEN 유지**
- [X] T011 `OAuth2SuccessHandler` 쿠키화 — `backend/.../auth/OAuth2SuccessHandler.kt`. URL fragment redirect → Set-Cookie + fragment 없는 redirect(홈 또는 `/auth/success`). link flow(`linkUserId`) 분기 유지. + `OAuth2SuccessHandlerTest.kt` 쿠키 케이스 확장. (research R-5)
- [X] T012 `SecurityConfig` csrf/cors 검토 — 변경 없음 확인(same-origin + SameSite=Lax + 비-GET → `csrf().disable()` 유지, CORS 직접 호출 대비 유지) — `backend/.../config/SecurityConfig.kt`. same-origin 프록시 전제로 `csrf().disable()` 유지 확인 + CORS 영향(직접 호출 대비 유지 여부). 변경 시 003 테스트 정합 확인 (research R-8)
- [X] T013 backend 검증 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`. 003/004 전체 회귀 GREEN + 쿠키 케이스 (research R-11, ISSUE-010 교훈 — 좁은 게이트 금지)

### Frontend — 프록시 + client swap

- [X] T014 [P] `next.config.ts` rewrites — `frontend/next.config.ts`. `async rewrites()` 로 `/api/:path*` → `${BACKEND_ORIGIN}/api/:path*`. env 정합. (research R-1, contracts/proxy-and-client.md §1)
- [X] T015 `client.ts` swap — `frontend/src/lib/api/client.ts`. `X-User-Id`/`useAuthPlaceholder` 제거 + same-origin 상대 경로 + `credentials:'include'` + 401 reactive refresh(1회, 무한루프 방지). (research R-7/R-9, FR-008)
- [X] T016 [P] `client.ts` 테스트 — `frontend/src/lib/api/client.test.ts`. msw 로 (a) 200 unwrap (b) 401 → refresh → 재시도 성공 (c) refresh 401 → throw. (RED→GREEN)
- [X] T017 `authPlaceholder` 폐기 — `frontend/src/stores/authPlaceholder.ts` 제거 + 잔존 import 정리(`grep -rn "authPlaceholder\|X-User-Id" frontend/src` = 0건). (R-9, SC-008)
- [X] T018 [P] `lib/api/auth.ts` 신설 — `frontend/src/lib/api/auth.ts`. login/signupEmail/verifyEmail/requestPasswordReset/confirmPasswordReset/fetchMe/logout. (contracts/proxy-and-client.md §4)
- [X] T019 `useAuthGuard` /me 전환 — `frontend/src/lib/auth/guard.ts`. `useQuery(['auth','me'])` 기반 requireAuth/guestOnly. (R-7, FR-025)
- [X] T020 [P] `types/api.ts` 확장 — `frontend/src/types/api.ts`. Project/Character/AuthMe 표시 타입(data-model §2/§3/§1)
- [X] T021 frontend 검증 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. RSC 경계 검출(002 회귀 — build 의무)

**Checkpoint**: 쿠키 세션으로 보호 endpoint(`/api/projects`, `/api/auth/me`) 접근 가능. 003 회귀 GREEN. US1~US6 시작 가능.

---

## Phase 3: User Story 1 — 로그인하여 내 프로젝트 목록 보기 (Priority: P1) 🎯 MVP

**Goal**: 이메일 로그인 → 쿠키 세션 → 홈 실데이터(또는 H0). 세션 새로고침 유지.

**Independent Test**: 가입·인증 계정으로 로그인 → 홈 목록/빈 상태 표시 → 새로고침 유지. T051(홈 placeholder query) GREEN.

- [X] T022 [P] [US1] `LoginForm` 실동작 — `frontend/src/components/auth/LoginForm.tsx`(`'use client'`). `login` mutation + 성공 시 `['auth','me']` 무효화 + 홈 이동 + 에러 code(EMAIL_NOT_VERIFIED/LOGIN_FAILED/LOGIN_LOCKED) 메시지. (contracts/screen-data-flow.md §5)
- [X] T023 [P] [US1] `LoginForm` 테스트 — `frontend/src/components/auth/LoginForm.test.tsx`. 성공 흐름 + 실패 code 표시 (msw). (RED→GREEN)
- [X] T024 [US1] 홈 `page.tsx` 실데이터 — `frontend/src/app/page.tsx`. 기존 `listProjects` query 검증 + **에러 상태와 빈 상태 분리**(현재 isError→empty 취급 → 에러는 재시도 표시). (FR-013/014/026)
- [X] T025 [US1] 인증 가드 redirect 검증 — 비로그인 홈 접근 → `/auth/login`. (FR-025, SC-005)
- [X] T026 [US1] **T051 재검증** — quickstart §3-3. 로그인 쿠키 세션으로 홈 목록 unwrap GREEN(이전 401). (SC-002)

**Checkpoint**: 로그인 → 홈 (MVP). 독립 동작·테스트 가능.

---

## Phase 4: User Story 2 — 새 프로젝트 만들기 (Priority: P2)

**Goal**: `/projects/new` 폼(제목 필수 + 메타 5필드) → 생성 → 프로젝트 화면 이동.

**Independent Test**: 새 프로젝트 진입 → 제목 입력 생성 → 목록/상세 반영. 제목 누락 시 검증 메시지.

- [X] T027 [P] [US2] `projects.ts` createProject — `frontend/src/lib/api/projects.ts`. POST /api/projects. (contracts/proxy-and-client.md §4)
- [X] T028 [US2] `/projects/new` 폼 — `frontend/src/app/projects/new/page.tsx`(`'use client'`). title(필수) + 메타 5필드(선택). (FR-016)
- [X] T029 [US2] 생성 성공 흐름 — `['projects']` 무효화 + `/projects/{id}` 이동. (FR-017)
- [X] T030 [P] [US2] 새 프로젝트 폼 테스트 — `frontend/src/app/projects/new/page.test.tsx`. title 누락 검증 + 생성 후 이동(msw). (FR-018, RED→GREEN)

**Checkpoint**: US1 + US2 독립 동작.

---

## Phase 5: User Story 3 — 메타 카드 + 편집 + 생명주기 (Priority: P3)

**Goal**: `/projects/[id]` 메타 카드 + 전용 편집 페이지 + 보관/보관해제/삭제.

**Independent Test**: 메타 카드 표시 → 편집 일부 수정 반영 → 보관/해제/삭제 동작.

- [X] T031 [P] [US3] `projects.ts` get/patch/archive/unarchive/delete — `frontend/src/lib/api/projects.ts`
- [X] T032 [P] [US3] `MetaCard` 표시 컴포넌트 — `frontend/src/components/projects/MetaCard.tsx`. 메타 6필드(빈 필드 표시). (FR-019)
- [X] T033 [US3] `/projects/[id]` page — `frontend/src/app/projects/[id]/page.tsx`. `getProject` + MetaCard + 액션(편집/보관/삭제/등장인물 링크) + 404 안내
- [X] T034 [US3] `/projects/[id]/edit` 편집 폼 — `frontend/src/app/projects/[id]/edit/page.tsx`(`'use client'`). PATCH(null=미변경) + 성공 시 `['project',id]`+`['projects']` 무효화 + 복귀. (FR-020)
- [X] T035 [US3] lifecycle 동작 — archive/unarchive/delete(확인 모달) + 목록 무효화. (FR-021)
- [X] T036 [P] [US3] 편집/lifecycle 테스트 — `frontend/src/app/projects/[id]/edit/page.test.tsx`. 부분 수정 + 삭제 확인(msw). (RED→GREEN)

**Checkpoint**: US1~US3 독립 동작.

---

## Phase 6: User Story 4 — 등장인물 관리 (Priority: P4)

**Goal**: `/projects/[id]/characters` 목록·생성·편집·삭제·재정렬.

**Independent Test**: 인물 추가 → 목록 표시 → 편집/삭제 → 재정렬 후 새로고침 순서 유지.

- [X] T037 [P] [US4] `characters.ts` 신설 — `frontend/src/lib/api/characters.ts`. list/get/create/patch/reorder/delete. (contracts/proxy-and-client.md §4)
- [X] T038 [P] [US4] `CharacterList` 표시 컴포넌트 — `frontend/src/components/projects/CharacterList.tsx`. 표시 순서대로. (FR-022)
- [X] T039 [US4] `/projects/[id]/characters` page — `frontend/src/app/projects/[id]/characters/page.tsx`(`'use client'`). 목록 + 생성(name 필수) + 편집 + 삭제. (FR-022/023)
- [X] T040 [US4] reorder 동작 — 응답 목록으로 갱신(별도 GET 불필요) + 빈 배열 no-op. (FR-024)
- [X] T041 [P] [US4] 등장인물 테스트 — `frontend/src/app/projects/[id]/characters/page.test.tsx`. 생성/reorder 응답 갱신 + 검증 실패(누락/중복/외부 ID) 400 표시(msw). (RED→GREEN, SC-006)

**Checkpoint**: US1~US4 독립 동작.

---

## Phase 7: User Story 5 — 회원가입 · 이메일 인증 · 비밀번호 재설정 (Priority: P5)

**Goal**: 회원가입 + 이메일 인증 + 비밀번호 재설정 4단계 실동작.

**Independent Test**: 신규 가입 → 인증 → 로그인. 재설정 요청 → 새 비번 → 로그인.

- [X] T042 [P] [US5] `SignupEmailForm` 실동작 — `frontend/src/components/auth/SignupEmailForm.tsx`. signupEmail + 인증 메일 안내 + 409/400 code. (FR-009)
- [X] T043 [US5] 이메일 인증 흐름 — `frontend/src/app/auth/verify-pending/` + `verify-done/`. verifyEmail(token) 연동. (FR-009)
- [X] T044 [US5] 비밀번호 재설정 4단계 — `frontend/src/components/auth/ResetRequestForm.tsx` + `ResetNewForm.tsx` + `frontend/src/app/auth/reset-*`. request/confirm 연동. (FR-010)
- [X] T045 [P] [US5] 가입/재설정 테스트 — 성공 + 주요 실패 code(msw). (RED→GREEN)

**Checkpoint**: US1~US5 독립 동작.

---

## Phase 8: User Story 6 — 카카오 로그인 · 추가 연결 (Priority: P6)

**Goal**: 카카오 로그인(콜백 쿠키 — R1) + 추가 연결 + 충돌 안내.

**Independent Test**: 카카오 로그인 → 콜백 쿠키 → 홈. 이메일 로그인 상태 카카오 추가 연결.

- [X] T046 [US6] `KakaoButton` 진입 — `frontend/src/components/auth/KakaoButton.tsx`. `/api/auth/oauth/kakao` 브라우저 네비게이션. (FR-011)
- [X] T047 [US6] 카카오 콜백 도착 처리 — `/auth/success` 라우트 신설 또는 홈 redirect(OAuth2SuccessHandler T011 redirect 대상과 정합). (research R-5)
- [X] T048 [US6] 카카오 추가 연결 — `POST /api/auth/link/kakao` 진입 + `/auth/link-success` + 충돌(KAKAO_ALREADY_LINKED/KAKAO_LINK_CONFLICT) 안내. (FR-011)
- [X] T049 [US6] 카카오 dogfooding(제약) — 외부 카카오 인가 화면 + 앱 redirect_uri 설정 의존. quickstart §3 주석대로 범위 명시 검증. (SC-007)

**Checkpoint**: US1~US6 모두 독립 동작.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T050 [P] 에러 code → 한국어 메시지 매핑 일관화 — `frontend/src/lib/`(공통 매핑). (FR-012)
- [X] T051 [P] 다크 모드 + 디자인 토큰 일관성 검증 — 신규 화면 5종 라이트/다크 dogfooding. (SC-009, 한국어 cadence HARD-GATE) — 사용자 dogfooding 완료 처리(2026-05-30)
- [X] T052 SC-008 검증 — `grep -rn "X-User-Id" frontend/src` = 0건
- [X] T053 전체 검증 게이트 — frontend `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + backend `./gradlew ktlint* checkstyleMain test build`
- [X] T054 quickstart dogfooding 전체 — `quickstart.md §3-1~§3-10` 직접 검증(SC-001~009). 카카오 제약 영역 명시 — 사용자 dogfooding 완료 처리(2026-05-30, 카카오는 외부 인가 제약 영역)
- [X] T055 docs/plan/02-progress.md + vault `02-PROGRESS`/`03-ISSUES`(ISSUE-015 종료) 갱신 + 5축 회고 — 완료(`3e8ecc9`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(Phase 1)**: 즉시 시작. T002→T003/T004 순(설치 후 config/scripts)
- **Foundational(Phase 2 = R1)**: Setup 후. backend(T005~T013) ⇆ frontend(T014~T021) 병렬 가능하나 **둘 다 완료해야 Checkpoint**(쿠키 인증 e2e). 모든 US 차단
- **US1~US6(Phase 3~8)**: Foundational 후 시작. 우선순위 P1→P6 순차 권장(혼자 작업) 또는 병렬(독립)
- **Polish(Phase 9)**: 원하는 US 완료 후

### User Story Dependencies

- **US1(P1)**: Foundational 후 — 다른 US 의존 없음. MVP
- **US2(P2)**: Foundational 후. 홈(US1) CTA 가 진입점이나 독립 테스트 가능
- **US3(P3)**: Foundational 후. US2 생성 결과 사용하나 독립 테스트 가능(기존 프로젝트로)
- **US4(P4)**: Foundational 후. US3 프로젝트 컨텍스트 사용하나 독립 테스트 가능
- **US5(P5)**: Foundational 후 — 인증 보조 흐름, 독립
- **US6(P6)**: Foundational 후(콜백 쿠키화 R1 포함) — 독립

### Within Each Story

- 테스트(포함 시) RED 먼저 → 구현 GREEN
- API 함수 → 표시 컴포넌트 → page → 통합
- `'use client'` 의무 컴포넌트는 작성 직후 `pnpm build` (002 RSC 경계 회귀)

### Parallel Opportunities

- Setup: T003/T004 [P]
- Foundational: backend [P](T005/T006) + frontend [P](T014/T018/T020) 트랙 병렬. T007/T009/T011 은 순차(같은 인증 흐름)
- 각 US 내 [P] 테스트·API 함수·표시 컴포넌트 병렬
- US 간: Foundational 후 US1~US6 독립 병렬 가능(팀 작업 시)

---

## Parallel Example: Foundational (R1)

```text
# backend 트랙 + frontend 트랙 동시 진행 가능 (Checkpoint 에서 합류)
backend:  T005[P] AuthCookieFactory → T007 필터 → T009 컨트롤러 → T011 OAuth → T013 게이트
frontend: T014[P] rewrites / T018[P] auth.ts / T020[P] types → T015 client → T019 guard → T021 게이트
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup(테스트 인프라)
2. Phase 2 Foundational(R1 쿠키 전환 — backend+frontend, 003 회귀 GREEN)
3. Phase 3 US1(로그인+홈)
4. **STOP & VALIDATE**: quickstart §3-1~§3-4 + T051 재검증(SC-002)
5. MVP — 로그인 → 내 프로젝트 목록

### Incremental Delivery

Setup+Foundational → US1(MVP) → US2 → US3 → US4 → US5 → US6 → Polish. 각 US 독립 검증 후 다음.

---

## Notes

- [P] = 다른 파일·미완 의존 없음
- TDD: 로직 테스트 RED→GREEN. 정적 외관/라우트 골격/타입 선언은 완화(§5-5)
- **HARD-GATE**: 003 헤더 회귀 GREEN 유지(R-3 병존) / RSC 경계 `pnpm build`(002) / 외부 DB 쓰기 0(쿠키는 전달 매체만) / 라운드 종료 시 전체 게이트(ISSUE-010 교훈)
- 카카오(US6) 로컬 dogfooding 은 외부 인가 의존 — 범위 명시
- commit 은 라운드(phase) 단위 권장
