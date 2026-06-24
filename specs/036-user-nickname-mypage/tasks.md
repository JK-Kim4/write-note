---
description: "Task list for 사용자 닉네임 + 마이페이지"
---

# Tasks: 사용자 닉네임 + 마이페이지

**Input**: Design documents from `specs/036-user-nickname-mypage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함(CLAUDE.md TDD HARD-GATE — 행위 단위 테스트 우선).

**Organization**: User Story 단위 phase. 단, **배포는 R1(BE 일괄)→R2(FE 일괄)** 순서(방향 의존: FE 가 nickname 을 읽음). 각 task 에 `[BE]`/`[FE]` 표기.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 선행 의존 없음)
- **[Story]**: US1/US2/US3 (spec.md user story)
- `[BE]`/`[FE]`: 배포 묶음 식별(R1=BE, R2=FE)

## Path Conventions

- 백엔드: `backend/src/main/kotlin/com/writenote/`, 테스트 `backend/src/test/kotlin/com/writenote/`
- 프론트: `frontend/src/`

---

## Phase 1: Setup

**Purpose**: 신규 영역 골격

- [X] T001 [P] [BE] 닉네임 도메인 패키지 디렉토리 생성 `backend/src/main/kotlin/com/writenote/nickname/` (이후 task 가 채움)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 user story 의 전제 — 닉네임 컬럼·엔티티·조회. **완료 전 어떤 US 도 시작 불가.**

**⚠️ CRITICAL**: 로컬 dev DB 직접 적용 금지(IT/Testcontainers 만).

- [X] T002 [BE] V23 마이그레이션 작성 `backend/src/main/resources/db/migration/V23__add_users_nickname.sql` — `nickname VARCHAR(16)` nullable 추가 → `UPDATE users SET nickname='사용자'||id WHERE nickname IS NULL` 백필 → `SET NOT NULL` + `ADD CONSTRAINT uk_users_nickname UNIQUE(nickname)` (data-model.md 순서)
- [X] T003 [BE] User 엔티티에 `nickname: String` 필드 추가 (`@Column(nullable=false, unique=true, length=16)`) `backend/src/main/kotlin/com/writenote/entity/User.kt`
- [X] T004 [BE] `UserRepository.existsByNickname(nickname: String): Boolean` 추가 `backend/src/main/kotlin/com/writenote/repository/UserRepository.kt` (기존 existsByEmail 패턴)

**Checkpoint**: 컬럼·엔티티·조회 준비 완료 — US 구현 시작 가능.

---

## Phase 3: User Story 1 - 모든 사용자가 고유 닉네임 보유 (Priority: P1) 🎯 MVP

**Goal**: 신규 가입(이메일·카카오) 시 큐레이션 한글 닉네임 자동 부여 + 기존 회원 백필(T002) → 닉네임 미보유 계정 0건. me() 응답에 nickname·createdAt 노출.

**Independent Test**: 신규 가입 후 `/api/auth/me` 응답에 한글 단어조합 nickname 이 채워져 있고, 기존 회원도 닉네임을 보유한다(DB/응답으로 확인). 마이페이지 UI 없이 검증 가능.

### Tests for User Story 1 ⚠️ (먼저 작성·실패 확인)

- [X] T005 [P] [US1] [BE] `NicknameGenerator` 행위 테스트 — 생성값이 형식(`^[가-힣a-zA-Z0-9_]{2,16}$`) 만족, 충돌 시 재추첨으로 고유성 보장 `backend/src/test/kotlin/com/writenote/nickname/NicknameGeneratorTest.kt`
- [X] T006 [P] [US1] [BE] `NicknameWords` 안전성 테스트 — 큐레이션 수식어·명사 사전에 금칙어 사전 단어가 0건 포함 `backend/src/test/kotlin/com/writenote/nickname/NicknameWordsTest.kt`
- [X] T007 [P] [US1] [BE] 가입 자동 부여 통합 테스트 — signupEmail·카카오 등록 후 User.nickname 보유 + me() 응답 nickname 노출 `backend/src/test/kotlin/com/writenote/service/SignupNicknameIT.kt`

### Implementation for User Story 1

- [X] T008 [P] [US1] [BE] `NicknameWords` 큐레이션 상수 작성 — 안전 수식어·명사 목록(비속어·차별·혐오·성적·정치/종교 갈등 배제, FR-004) `backend/src/main/kotlin/com/writenote/nickname/NicknameWords.kt`
- [X] T009 [US1] [BE] `NicknameGenerator` 구현 — `수식어+명사+4자리숫자`, `existsByNickname` 충돌 재추첨(최대 N회·자릿수 확장) `backend/src/main/kotlin/com/writenote/nickname/NicknameGenerator.kt` (depends T004, T008)
- [X] T010 [US1] [BE] `AuthService.signupEmail` 에 닉네임 자동 부여 결선(User 생성 시 generator) `backend/src/main/kotlin/com/writenote/service/AuthService.kt` (depends T009)
- [X] T011 [US1] [BE] `KakaoUserRegistrar.registerAndCreateKey` 에 닉네임 자동 부여 결선 `backend/src/main/kotlin/com/writenote/auth/KakaoUserRegistrar.kt` (depends T009)
- [X] T012 [US1] [BE] `AuthMeResponse` 에 `nickname: String`·`createdAt: Instant?` 추가(additive) + `UserAuthConverter.toAuthMeResponse` 매핑(`user.nickname`·`user.createdAt`) `backend/src/main/kotlin/com/writenote/model/response/AuthMeResponse.kt`, `backend/src/main/kotlin/com/writenote/components/UserAuthConverter.kt`

**Checkpoint**: 닉네임 존재 보장(양보 불가 핵심) 실현. me() 로 검증 가능.

---

## Phase 4: User Story 2 - 마이페이지에서 닉네임 변경 (Priority: P2)

**Goal**: 마이페이지에서 닉네임을 변경(형식·금칙어·중복 검증). 변경 endpoint(BE) + 마이페이지 변경 폼(FE) + 진입점.

**Independent Test**: 마이페이지 진입 → 닉네임 변경 → 재조회 시 새 값 유지. 중복/형식/금칙어 시도는 인라인 에러로 거부.

### Tests for User Story 2 ⚠️ (먼저 작성·실패 확인)

- [X] T013 [P] [US2] [BE] 닉네임 변경 endpoint 통합 테스트 — 정상 200 / 중복 409 `NICKNAME_ALREADY_REGISTERED` / 형식 400 `NICKNAME_INVALID_FORMAT` / 금칙어 400 `NICKNAME_FORBIDDEN_WORD` / 비로그인 401 / 자기동일값 수용 `backend/src/test/kotlin/com/writenote/controller/UserControllerIT.kt`
- [X] T014 [P] [US2] [BE] `NicknamePolicy` 형식 검증 단위 테스트(trim·2~16자·허용문자) `backend/src/test/kotlin/com/writenote/nickname/NicknamePolicyTest.kt`
- [X] T015 [P] [US2] [BE] `ForbiddenWords` 포함 검사 단위 테스트(정규화 후 금칙어 차단) `backend/src/test/kotlin/com/writenote/nickname/ForbiddenWordsTest.kt`

### Implementation for User Story 2 — Backend (R1)

- [X] T016 [P] [US2] [BE] `AuthErrorCode` 에 3개 추가(409 그룹: `NICKNAME_ALREADY_REGISTERED`, 400 그룹: `NICKNAME_INVALID_FORMAT`·`NICKNAME_FORBIDDEN_WORD`) `backend/src/main/kotlin/com/writenote/enums/AuthErrorCode.kt`
- [X] T017 [P] [US2] [BE] `NicknamePolicy` 구현(trim·정규식 형식 검증) `backend/src/main/kotlin/com/writenote/nickname/NicknamePolicy.kt`
- [X] T018 [P] [US2] [BE] `ForbiddenWords` 구현(금칙어 사전 + 정규화 포함 검사) `backend/src/main/kotlin/com/writenote/nickname/ForbiddenWords.kt`
- [X] T019 [US2] [BE] `SetNicknameRequest` DTO(`@field:NotBlank @field:Size(min=2,max=16)`) `backend/src/main/kotlin/com/writenote/model/request/SetNicknameRequest.kt`
- [X] T020 [US2] [BE] `UserService.changeNickname` 구현 — 형식(T017)·금칙어(T018)·중복(T004)·자기동일값 수용, 위반 시 `AuthException` `backend/src/main/kotlin/com/writenote/service/UserService.kt` (depends T016–T019)
- [X] T021 [US2] [BE] `UserController` `PATCH /api/users/me/nickname` — 인증 principal, 변경 후 `AuthMeResponse` 반환 `backend/src/main/kotlin/com/writenote/controller/UserController.kt` (depends T020, contracts/nickname-change.md)

### Implementation for User Story 2 — Frontend (R2)

- [X] T022 [P] [US2] [FE] `types/api.ts` 의 `AuthMeResponse` 에 `nickname: string`·`createdAt: string | null` 추가 `frontend/src/types/api.ts`
- [X] T023 [P] [US2] [FE] `lib/api/users.ts` 에 `setNickname(nickname)` (`PATCH /api/users/me/nickname`, 응답 AuthMeResponse) `frontend/src/lib/api/users.ts`
- [X] T024 [US2] [FE] `NicknameSection` 컴포넌트(client) — 현재 닉네임 표시 + 변경 폼 + 에러 인라인(중복/형식/금칙어 code 분기) `frontend/src/components/mypage/NicknameSection.tsx` (depends T022, T023)
- [X] T025 [US2] [FE] `NicknameSection` RTL 테스트(msw) — 변경 성공·중복·형식·금칙어 인라인 표시 `frontend/src/components/mypage/NicknameSection.test.tsx`
- [X] T026 [US2] [FE] `/mypage` page 골격 + `NicknameSection` 결선 + 변경 성공 시 `["auth","me"]` invalidate + 헤더 마이페이지 진입점(`layout.tsx`) + **미인증 접근 가드**(기존 `(main)` 그룹 `useAuthGuard` 패턴 재사용 — 미로그인 시 리다이렉트, FR-016) `frontend/src/app/(main)/mypage/page.tsx`, `frontend/src/app/(main)/layout.tsx` (depends T024)

**Checkpoint**: 닉네임 변경(검증 4케이스) 동작. 마이페이지 접근 동선 확보.

---

## Phase 5: User Story 3 - 마이페이지에서 계정 정보 확인 (Priority: P3)

**Goal**: 마이페이지에 이메일·가입 방식·가입일 읽기전용 표시. (BE 는 US1 T012 에서 createdAt 이미 노출 → FE 전용.)

**Independent Test**: 마이페이지 진입 시 이메일·가입방식(카카오/이메일)·가입일이 정확히 표시.

### Implementation for User Story 3 — Frontend (R2)

- [X] T027 [P] [US3] [FE] `AccountInfoSection` 컴포넌트 — `email`·`kakaoLinked`(→카카오/이메일)·`createdAt`(가입일) 읽기전용 표시 `frontend/src/components/mypage/AccountInfoSection.tsx`
- [X] T028 [P] [US3] [FE] `AccountInfoSection` RTL 테스트 — 이메일·가입방식·가입일 렌더 `frontend/src/components/mypage/AccountInfoSection.test.tsx`
- [X] T029 [US3] [FE] `/mypage` page 에 `AccountInfoSection` 결선 `frontend/src/app/(main)/mypage/page.tsx` (depends T026, T027 — T026 과 같은 파일이라 순차)

**Checkpoint**: 마이페이지 완결(닉네임 변경 + 계정정보).

---

## Phase 6: Polish & Cross-Cutting

- [X] T030 [BE] R1 게이트 — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` GREEN 확인
- [X] T031 [FE] R2 게이트 — `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN 확인(RSC 경계 포함)
- [ ] T032 dogfooding — quickstart.md S1~S4 (자동 닉네임·변경 4케이스·계정정보·백필) 로컬 3종 기동 검증

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup(P1)** → **Foundational(P2)** → US1/US2/US3
- **Foundational(T002–T004)**: 모든 US 의 blocking 전제(컬럼·엔티티·조회)
- **US1(P3 phase)**: Foundational 후. 자동생성·백필·me 노출
- **US2(P4 phase)**: Foundational 후. BE 는 US1 의 AuthMeResponse(T012) 응답 반환에 의존
- **US3(P5 phase)**: US1 T012(createdAt 노출) + US2 T026(mypage page) 에 의존(같은 page 파일)

### 배포 묶음 (방향 의존: BE 선행 → FE 후행)

- **R1 (BE 일괄, 먼저 배포)**: T002–T021 의 모든 `[BE]` (Foundational + US1 + US2 백엔드 + AuthErrorCode/Policy/Forbidden)
- **R2 (FE 일괄, R1 배포 후)**: T022–T029 의 모든 `[FE]` (마이페이지·닉네임 변경 UI·계정정보)
- 회원가입 요청 폼 무변경 → 가입 흐름 회귀 없음

### Within Each Story

- 테스트 먼저 작성·실패 확인 → 구현(상수 → 생성기/정책 → 서비스 → 엔드포인트)
- 모델/상수 → 서비스 → 컨트롤러 → FE

### Parallel Opportunities

- T005·T006·T007 (US1 테스트) 병렬
- T013·T014·T015 (US2 BE 테스트) 병렬
- T016·T017·T018 (US2 BE 상수·enum·정책 — 다른 파일) 병렬
- T022·T023 (FE types·api) 병렬
- T027·T028 (US3 컴포넌트·테스트) 병렬

---

## Parallel Example: User Story 2 Backend 테스트

```bash
Task: "닉네임 변경 endpoint 통합 테스트 ... UserControllerIT.kt"   # T013
Task: "NicknamePolicy 형식 검증 단위 테스트 ... NicknamePolicyTest.kt"  # T014
Task: "ForbiddenWords 포함 검사 단위 테스트 ... ForbiddenWordsTest.kt"  # T015
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational(V23·엔티티·repo)
2. Phase 3 US1(자동생성·백필·me 노출)
3. **STOP & VALIDATE**: me() 로 닉네임 보유 확인 → 양보 불가 핵심 충족
4. R1 BE 배포

### Incremental Delivery

1. Foundational + US1 → 닉네임 존재(MVP)
2. US2 → 변경 UI (R1 BE 먼저 배포, 후 R2 FE)
3. US3 → 계정정보 (R2 에 포함)
4. dogfooding(T032) → develop merge

---

## Notes

- `[P]` = 다른 파일·선행 의존 없음
- BE subagent 위임 시: `ktlintFormat` main+test 양쪽 / 로컬 dev DB 적용 금지 / IT 는 Testcontainers (agent-workflow-discipline §4)
- `client.ts` 409 분기는 **error.code 기준** — `NICKNAME_ALREADY_REGISTERED` 는 일반 ApiError 흐름(code-quality §409 회귀 주의)
- FR-016(로그인만 접근): BE T013/T021 + FE T026 인증 가드 양쪽 커버
- 같은 파일 수정 task(T012 AuthMeResponse, T026/T029 mypage page, T026 layout)는 순차
- 각 task 또는 논리 그룹 후 커밋
