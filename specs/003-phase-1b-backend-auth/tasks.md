---
description: "Task list for Phase 1B Backend Auth Foundation implementation"
---

# Tasks: Phase 1B Backend Auth Foundation

**Input**: Design documents from `/specs/003-phase-1b-backend-auth/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/auth-endpoints.md](./contracts/auth-endpoints.md), [contracts/security-filter-chain.md](./contracts/security-filter-chain.md), [contracts/token-formats.md](./contracts/token-formats.md), [contracts/owner-context-migration.md](./contracts/owner-context-migration.md), [quickstart.md](./quickstart.md)

**Tests**: 본 spec 의 다음 영역은 **TDD HARD-GATE** (`~/.claude/rules/shared/testing-strategy.md`). 명시적 test task 박힘:
- 비밀번호 정책 검증 / 토큰 생성·라이프사이클 / JWT 발급·검증 (Component 단위)
- 5회 잠금 동시성 / 토큰 일회용 / 카카오 충돌 분기 / owner context 교체 (도메인 로직)
- 모든 endpoint의 happy path + 401 5종 코드 매핑 (Controller Web 테스트)

**Organization**: 6 User Story (P1~P6) 별 phase. Setup + Foundational + Polish 는 cross-cutting. 본 spec 의 라운드 분해는 quickstart.md §8 의 R-1~R-12 가 starting point — 본 tasks.md 가 그 분해를 더 세분화.

**Verification command (per round)**: `~/.claude/rules/shared/long-running-bash.md` 의 검증 minimize 룰 적용:
- 라운드 진행 중: `./gradlew :backend:test --tests "*{ClassName}*"` + `./gradlew :backend:ktlintMainSourceSetCheck :backend:ktlintTestSourceSetCheck` (좁은 테스트 2개 이하)
- 모든 phase 완료 후 1회: `./gradlew :backend:ktlintMainSourceSetCheck :backend:ktlintTestSourceSetCheck :backend:checkstyleMain :backend:test :backend:build` (전체 게이트, SC-009)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일 / 미완 의존 없음 → 병렬 가능
- **[Story]**: 본 task 가 속한 user story (US1~US6). Setup / Foundational / Polish 는 label 없음
- File path 의무 명시 (모두 `backend/` 기준 상대 경로)

## Path Conventions

- Web app monorepo — 본 spec 은 `backend/` 만 변경
- Kotlin source: `backend/src/main/kotlin/com/writenote/`
- Test source: `backend/src/test/kotlin/com/writenote/`
- Migration: `backend/src/main/resources/db/migration/`
- Config YAML: `backend/src/main/resources/application*.yml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성 추가 + 환경 변수 골격 + 4 신규 Config 빈 셋업

- [X] T001 신규 의존성 추가 — `backend/build.gradle.kts` 의 `dependencies` 블록에 `spring-boot-starter-oauth2-client` + `spring-boot-starter-mail` + `io.jsonwebtoken:jjwt-api:0.12.6` (impl + jackson runtimeOnly) 추가 (research.md R-1 / R-3, quickstart.md §1)
- [X] T002 [P] `application.yml` 갱신 — `backend/src/main/resources/application.yml` 에 `spring.security.oauth2.client.{registration,provider}.kakao` 블록 + `spring.mail` 블록 placeholder (env 변수 reference) + `app.auth.jwt.secret`/`app.auth.jwt.access-token-validity-seconds`/`app.auth.jwt.refresh-token-validity-seconds` 박음 (quickstart.md §2)
- [X] T003 [P] `application-local.yml` 갱신 — `backend/src/main/resources/application-local.yml` 에 local 전용 mail = log impl 시그널 + JWT secret env 로딩 (`JWT_SECRET`) + OAuth2 placeholder (실제 호출 안 함)
- [X] T004 [P] `application-test.yml` 갱신 (기존 파일) — `backend/src/main/resources/application-test.yml` 에 test 전용 mail = log impl + OAuth2 placeholder (test profile 결정성) + JWT secret 고정 (32 바이트 이상)
- [X] T005 [P] `.env.local.sample` 신설 — `backend/.env.local.sample` 에 `JWT_SECRET` / `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / `KAKAO_REDIRECT_URI` / `SMTP_*` / `MAIL_*` / `FRONTEND_BASE_URL` 키 명시 (값 비움, security.md 의 시크릿 보호 의무)

**Checkpoint**: 의존성·환경 변수 골격 준비 완료. 다음 phase 에서 Config 빈 + 인프라 구성.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 user story 의 기반 — 두 엔티티 (Users 확장 + AuthToken 신설) + Repository + 4 Config 빈 + 4 Component (PasswordPolicy / AuthTokenGenerator / AuthTokenLifecycle / JwtTokenProvider) + 3 필터 + AuthErrorEntryPoint + 에러 코드 enum + GlobalExceptionHandler 확장 + SecurityConfig baseline

**⚠️ CRITICAL**: 본 phase 완료 전 어떤 user story phase 도 진입 금지

### Config 빈

- [ ] T006 `JwtConfig.kt` 신설 — `backend/src/main/kotlin/com/writenote/config/JwtConfig.kt` 에 `JwtProperties` (`@ConfigurationProperties("app.auth.jwt")`) + `JwtTokenProvider` 빈 + 시크릿 검증 (32바이트 미만 → fail-fast). research.md R-1, token-formats.md §1
- [ ] T007 [P] `MailConfig.kt` + `MailSenderPort` 인터페이스 — `backend/src/main/kotlin/com/writenote/config/MailConfig.kt` + `backend/src/main/kotlin/com/writenote/auth/MailSenderPort.kt`. profile 별 구현: `LoggingMailSender` (local/test) + `JavaMailSenderAdapter` (prod, placeholder). research.md R-2
- [ ] T008 [P] `OAuth2Config.kt` 신설 — `backend/src/main/kotlin/com/writenote/config/OAuth2Config.kt` 에 카카오 `ClientRegistration` env 기반 (scope=`profile_nickname,account_email`). research.md R-3
- [ ] T009 [P] `CorsConfig.kt` 갱신 — `backend/src/main/kotlin/com/writenote/config/CorsConfig.kt` 에 V1 정책 (와일드카드 origin / 6 method / 4 헤더 / Location 노출 / credentials=false / maxAge=3600) 박음. research.md R-8, contracts/security-filter-chain.md §4
- [ ] T010 [P] `PasswordEncoderConfig.kt` 신설 — `backend/src/main/kotlin/com/writenote/config/PasswordEncoderConfig.kt` 에 `BCryptPasswordEncoder(strength = 12)` 빈. research.md R-4

### 에러 코드 + 도메인 예외 + 핸들러

- [ ] T011 [P] `AuthTokenType.kt` enum — `backend/src/main/kotlin/com/writenote/enums/AuthTokenType.kt` (`EMAIL_VERIFY`, `PASSWORD_RESET`, `REFRESH`). data-model.md §2
- [ ] T012 [P] `AuthErrorCode.kt` enum — `backend/src/main/kotlin/com/writenote/enums/AuthErrorCode.kt` 에 5종 401 + 검증/충돌 코드 + 한국어 메시지 (contracts/auth-endpoints.md §14)
- [ ] T013 [P] `AuthException.kt` — `backend/src/main/kotlin/com/writenote/error/AuthException.kt` (휴대용 코드 + HTTP status 페어)
- [ ] T014 `GlobalExceptionHandler.kt` 확장 — `backend/src/main/kotlin/com/writenote/error/GlobalExceptionHandler.kt` 에 `AuthException` 핸들러 추가 (Result<T> envelope 응답). T013 의존
- [ ] T015 [P] `AuthErrorEntryPoint.kt` 신설 — `backend/src/main/kotlin/com/writenote/auth/AuthErrorEntryPoint.kt` (Spring Security `AuthenticationEntryPoint` 구현, Result envelope JSON 응답). contracts/security-filter-chain.md §6

### Users 엔티티 확장 + V3 마이그레이션

- [ ] T016 `User.kt` 엔티티 확장 — `backend/src/main/kotlin/com/writenote/entity/User.kt` 에 `kakaoId` / `passwordHash` / `emailVerifiedAt` / `lastLoginAt` / `failedLoginCount` / `lockoutUntil` / `updatedAt` 컬럼 + `@CreatedDate`/`@LastModifiedDate` 추가. data-model.md §1
- [ ] T017 `V3__expand_users_for_auth.sql` 신설 — `backend/src/main/resources/db/migration/V3__expand_users_for_auth.sql` 에 ALTER TABLE + 부분 UNIQUE 인덱스 + CHECK 제약 작성. data-model.md §3. **적용은 사용자 컨펌 후 (external-infra-safety.md HARD-GATE)**
- [ ] T018 `UserRepository.kt` 확장 — `backend/src/main/kotlin/com/writenote/repository/UserRepository.kt` 에 `findByEmail` / `findByKakaoId` / `findByEmailForUpdate` (`@Lock(LockModeType.PESSIMISTIC_WRITE)`) 추가. data-model.md §7
- [ ] T019 [P] `UserRepositoryIT.kt` 통합 테스트 — `backend/src/test/kotlin/com/writenote/repository/UserRepositoryIT.kt` 에 1차 캐시 우회 패턴 (`flush + clear`) + DEFAULT (`updated_at`) / UNIQUE / CHECK 위반 케이스. `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` HARD-GATE

### AuthToken 엔티티 + V4 마이그레이션

- [ ] T020 [P] `AuthToken.kt` 엔티티 신설 — `backend/src/main/kotlin/com/writenote/entity/AuthToken.kt` (data-model.md §2 스케치 정합)
- [ ] T021 `V4__create_auth_tokens.sql` 신설 — `backend/src/main/resources/db/migration/V4__create_auth_tokens.sql` (data-model.md §4). **적용은 사용자 컨펌 후**
- [ ] T022 [P] `AuthTokenRepository.kt` 신설 — `backend/src/main/kotlin/com/writenote/repository/AuthTokenRepository.kt` (findByTokenHashAndType / deleteByTokenHashAndType / deleteByUserIdAndType / cleanupExpiredAndUsed). data-model.md §7
- [ ] T023 [P] `AuthTokenRepositoryIT.kt` 통합 테스트 — `backend/src/test/kotlin/com/writenote/repository/AuthTokenRepositoryIT.kt` (1차 캐시 우회 + UNIQUE 충돌 + cleanup 쿼리)

### Component (Service 비대화 방지) — TDD HARD-GATE

- [ ] T024 [P] `PasswordPolicyValidator.kt` Component + 단위 테스트 — `backend/src/main/kotlin/com/writenote/components/PasswordPolicyValidator.kt` (12자 + 영문/숫자/특수). 테스트: `backend/src/test/kotlin/com/writenote/components/PasswordPolicyValidatorTest.kt` (통과 / 12자 미만 / 영문 누락 / 숫자 누락 / 특수 누락 5 케이스). research.md R-4
- [ ] T025 [P] `AuthTokenGenerator.kt` Component + 단위 테스트 — `backend/src/main/kotlin/com/writenote/components/AuthTokenGenerator.kt` (32바이트 SecureRandom → base64url + SHA-256 해시 페어). 테스트: `backend/src/test/kotlin/com/writenote/components/AuthTokenGeneratorTest.kt` (길이 / 엔트로피 / 해시 결정성). research.md R-6
- [ ] T026 [P] `AuthTokenLifecycleManager.kt` Component + 단위 테스트 — `backend/src/main/kotlin/com/writenote/components/AuthTokenLifecycleManager.kt` (만료 검증 / 일회용 used_at / 재사용 거부). 테스트: `backend/src/test/kotlin/com/writenote/components/AuthTokenLifecycleManagerTest.kt` (유효 / 만료 / 사용 완료 3 케이스). contracts/token-formats.md
- [ ] T027 [P] `JwtTokenProvider` 단위 테스트 — `backend/src/test/kotlin/com/writenote/auth/JwtTokenProviderTest.kt` (발급 + payload (`sub`/`email`/`iat`/`exp`) 정확값 `eq()` matcher / 만료 / 변조 / RS256 잘못된 알고리즘 거부 4 케이스). T006 의존. TDD HARD-GATE — testing-strategy.md "any() matcher 금지"

### 인증 Principal + 3 필터 + SecurityConfig baseline

- [ ] T028 [P] `AuthenticatedPrincipal.kt` data class — `backend/src/main/kotlin/com/writenote/auth/AuthenticatedPrincipal.kt` (`userId: Long`, `email: String`). contracts/security-filter-chain.md §5
- [ ] T029 `JwtAuthenticationFilter.kt` 신설 — `backend/src/main/kotlin/com/writenote/auth/JwtAuthenticationFilter.kt` (`Bearer eyJ` 접두사 매칭 → JwtTokenProvider 검증 → SecurityContext 박음). T006/T028 의존
- [ ] T030 [P] `ApiTokenAuthenticationFilter.kt` 골격 — `backend/src/main/kotlin/com/writenote/auth/ApiTokenAuthenticationFilter.kt` (`Bearer wnt_` + `/api/capture` 한정. 본 spec 진입 시점 = 항상 401 — ApiToken 테이블 Week 4 신설 전까지). contracts/security-filter-chain.md §1
- [ ] T031 `SecurityConfig.kt` baseline — `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt` 에 SecurityFilterChain bean (CORS DSL + CSRF disabled + AuthErrorEntryPoint 등록 + JwtAuthenticationFilter / ApiTokenAuthenticationFilter / LoginAttemptFilter 등록 + 보호/공개 endpoint 매트릭스 설정). T009/T015/T029/T030 의존. **본 spec 의 모든 user story phase 의 보호/공개 endpoint 분기는 본 task 갱신**

### OpenAPI 보안 schema

- [ ] T032 [P] `OpenApiConfig.kt` 갱신 — `backend/src/main/kotlin/com/writenote/config/OpenApiConfig.kt` 에 `BearerJwt` + `BearerApiToken` 두 SecurityScheme 등록 (contracts/security-filter-chain.md §7)

**Checkpoint**: 두 엔티티 + Repository + 4 Config + 4 Component + 3 필터 + Security baseline 준비 완료. 이제 user story 별 endpoint 구현 가능.

**🛑 V3 / V4 마이그레이션 적용 컨펌 시점**: T017 / T021 SQL 작성·리뷰 후, 본 phase 종료 시점에 사용자에게 명시 컨펌:
> "V3 + V4 마이그레이션 SQL 작성 완료. 로컬 docker postgres (`docker compose up -d --wait postgres`) 에 적용해도 되겠어? 적용 후 기존 user row 가 `users_credential_present` CHECK 위반될 수 있음 (V3 의 추가 컬럼 모두 NULL)."

---

## Phase 3: User Story 1 - 이메일·비밀번호 회원가입 및 로그인 (Priority: P1) 🎯 MVP

**Goal**: 작가 본인이 이메일·비밀번호로 회원가입 → 이메일 인증 → 로그인 → JWT 로 보호 endpoint 호출 → 토큰 갱신 → 로그아웃 흐름 GREEN.

**Independent Test**: quickstart.md §6-1 의 curl 흐름 GREEN. 자동 회귀로 AuthServiceIT + AuthControllerWebTest GREEN.

### DTO + 이벤트

- [ ] T033 [P] [US1] 인증 Request DTO 5종 — `backend/src/main/kotlin/com/writenote/model/request/SignupEmailRequest.kt`, `VerifyEmailRequest.kt`, `LoginRequest.kt`, `RefreshTokenRequest.kt`, `LogoutRequest.kt` (`@Email` / `@NotBlank` Hibernate Validator)
- [ ] T034 [P] [US1] 인증 Response DTO — `backend/src/main/kotlin/com/writenote/model/response/TokenPairResponse.kt`, `AuthMeResponse.kt`, `SignupEmailResponse.kt`
- [ ] T035 [P] [US1] `EmailVerificationRequestedEvent.kt` — `backend/src/main/kotlin/com/writenote/auth/EmailVerificationRequestedEvent.kt` (userId, email, 평문 token)
- [ ] T036 [US1] `EmailVerificationListener.kt` — `backend/src/main/kotlin/com/writenote/auth/EmailVerificationListener.kt` `@TransactionalEventListener(phase = AFTER_COMMIT)` (MailSenderPort 호출). T007/T035 의존, `~/.claude/rules/java/spring/spring-patterns.md` §"@Transactional + @TransactionalEventListener 계약"

### Converter

- [ ] T037 [P] [US1] `UserAuthConverter.kt` Component — `backend/src/main/kotlin/com/writenote/components/UserAuthConverter.kt` (User → AuthMeResponse 변환. 본 spec 진입 시점 activeApiTokenCount=0 고정)

### Service (TDD HARD-GATE)

- [ ] T038 [US1] `AuthService.kt` 신설 + 통합 테스트 — `backend/src/main/kotlin/com/writenote/service/AuthService.kt` (signupEmail / verifyEmail / login (P4 잠금 카운트는 US4 에서 합류) / refresh / logout / me 메서드). 트랜잭션 경계 박음 (`@Transactional(rollbackFor = Exception::class)`). 메일 발송은 트랜잭션 외부 (이벤트 AFTER_COMMIT). 테스트: `backend/src/test/kotlin/com/writenote/service/AuthServiceIT.kt` (Testcontainers + `EntityManager.flush+clear` 패턴, 5 시나리오: 신규 가입 / 인증 / 로그인 / refresh / 로그아웃 후 refresh 거부). T014/T024/T025/T026/T036 의존

### Controller + Security 갱신

- [ ] T039 [US1] `AuthController.kt` 신설 — `backend/src/main/kotlin/com/writenote/controller/AuthController.kt` (POST /api/auth/signup/email / verify-email / login / refresh / POST /api/auth/logout / GET /api/auth/me). 모든 endpoint 가 Result<T> envelope. T038 의존
- [ ] T040 [US1] `SecurityConfig.kt` 갱신 — T031 의 baseline 위에 본 US1 endpoint 공개/보호 매트릭스 박음 (`/api/auth/signup/email` / `/api/auth/verify-email` / `/api/auth/login` / `/api/auth/refresh` 공개, `/api/auth/logout` / `/api/auth/me` 보호)

### Web 테스트 (회귀 게이트)

- [ ] T041 [US1] `AuthControllerWebTest.kt` 신설 — `backend/src/test/kotlin/com/writenote/controller/AuthControllerWebTest.kt` (`@WebMvcTest` 또는 `@SpringBootTest`, MockMvc). 시나리오: signup 성공 / 이메일 형식 오류 / 약한 비밀번호 / 중복 가입 / verify-email happy / 만료 / 재사용 / login happy / 미인증 거부 / refresh / logout (총 12+ 케이스, contracts/auth-endpoints.md 의 매트릭스 정합)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*Auth*" :backend:ktlintMainSourceSetCheck :backend:ktlintTestSourceSetCheck` GREEN 의무.

**Checkpoint**: US1 GREEN 시점에 quickstart §6-1 curl 흐름 본인 dogfooding 가능. 본 spec 의 MVP 완료.

---

## Phase 4: User Story 2 - 카카오 한 번 동의로 즉시 로그인 (Priority: P2)

**Goal**: 한국어 작가가 카카오 동의 1회로 신규 계정 자동 생성 + 즉시 보호 endpoint 진입.

**Independent Test**: quickstart.md §6-4 (외부 카카오 콘솔 의존). 자동 회귀로 `KakaoOAuth2UserServiceTest` (카카오 API mock) + Web 테스트 GREEN.

### Service + Handler + Component

- [ ] T042 [P] [US2] `KakaoConflictChecker.kt` Component + 단위 테스트 — `backend/src/main/kotlin/com/writenote/components/KakaoConflictChecker.kt` (이메일 충돌 / 카카오 식별자 충돌 / 추가 연결 분기 결정). 테스트: `backend/src/test/kotlin/com/writenote/components/KakaoConflictCheckerTest.kt` (3 분기 케이스, FR-022 / FR-025)
- [ ] T043 [US2] `KakaoOAuth2UserService.kt` 신설 + 단위 테스트 — `backend/src/main/kotlin/com/writenote/auth/KakaoOAuth2UserService.kt` (Spring `OAuth2UserService<OAuth2UserRequest, OAuth2User>` 커스텀 — Kakao 응답 → User 조회/생성). 외부 카카오 API 호출은 트랜잭션 밖. 테스트: `backend/src/test/kotlin/com/writenote/auth/KakaoOAuth2UserServiceTest.kt` (신규 가입 / 기존 연결 / 이메일 충돌 + 비로그인 3 케이스, mock OAuth2UserRequest). T042 의존
- [ ] T044 [US2] `OAuth2SuccessHandler.kt` 신설 — `backend/src/main/kotlin/com/writenote/auth/OAuth2SuccessHandler.kt` (`AuthenticationSuccessHandler` 구현 — JWT 발급 + refresh token DB INSERT + URL fragment redirect `{frontend}/auth/success#access=...&refresh=...`). T006/T038 의존

### Security 갱신

- [ ] T045 [US2] `SecurityConfig.kt` 갱신 — `oauth2Login {}` DSL 등록 + 콜백 endpoint (`/api/auth/oauth/kakao/callback`) 공개 + `OAuth2SuccessHandler` 와 `KakaoOAuth2UserService` 결선

### Web 테스트

- [ ] T046 [US2] OAuth flow Web 테스트 — `backend/src/test/kotlin/com/writenote/controller/AuthOauthCallbackWebTest.kt` (콜백 happy / KAKAO_EMAIL_ALREADY_REGISTERED 충돌 / OAUTH_FAILED 일반 실패. Kakao API mock 으로 OAuth2UserService 결과 주입)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*Kakao*" --tests "*OAuth*" :backend:ktlintMainSourceSetCheck` GREEN.

**Checkpoint**: US2 GREEN — 본인이 카카오 콘솔에 redirect URI 등록 후 quickstart §6-4 dogfooding 가능. US1 ↔ US2 둘 다 독립 동작.

---

## Phase 5: User Story 3 - 비밀번호 재설정 (Priority: P3)

**Goal**: 비밀번호를 잊은 사용자가 메일로 받은 30분 만료 토큰으로 새 비밀번호 설정 + 사용자의 모든 refresh token 삭제 (보안).

**Independent Test**: quickstart.md §6-3 curl 흐름. 자동 회귀로 `PasswordResetServiceIT` GREEN (30분 만료 + 일회용 + REFRESH cascade 삭제).

### DTO + 이벤트

- [ ] T047 [P] [US3] 재설정 DTO 2종 — `backend/src/main/kotlin/com/writenote/model/request/PasswordResetRequestRequest.kt`, `PasswordResetConfirmRequest.kt`
- [ ] T048 [P] [US3] `PasswordResetRequestedEvent.kt` — `backend/src/main/kotlin/com/writenote/auth/PasswordResetRequestedEvent.kt`
- [ ] T049 [US3] `PasswordResetListener.kt` — `backend/src/main/kotlin/com/writenote/auth/PasswordResetListener.kt` `@TransactionalEventListener(AFTER_COMMIT)` (MailSenderPort 호출). T007/T048 의존

### Service (TDD HARD-GATE)

- [ ] T050 [US3] `PasswordResetService.kt` 신설 + 통합 테스트 — `backend/src/main/kotlin/com/writenote/service/PasswordResetService.kt` (request + confirm. confirm 시 사용자의 모든 REFRESH row 삭제 — contracts/auth-endpoints.md §7). 테스트: `backend/src/test/kotlin/com/writenote/service/PasswordResetServiceIT.kt` (가입 미존재 이메일도 200 / happy / 만료 / 재사용 거부 / 약한 비밀번호 거부 / REFRESH 삭제 검증 6 케이스). T024/T026 의존

### Controller + Security

- [ ] T051 [US3] `AuthController.kt` 갱신 — `/api/auth/password-reset/request` + `/api/auth/password-reset/confirm` 2 endpoint 추가
- [ ] T052 [US3] `SecurityConfig.kt` 갱신 — 두 endpoint 공개 추가

### Web 테스트

- [ ] T053 [US3] Web 테스트 — `backend/src/test/kotlin/com/writenote/controller/AuthPasswordResetWebTest.kt` (4 케이스: happy / 만료 / 재사용 / 약한 비밀번호)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*PasswordReset*" :backend:ktlintMainSourceSetCheck` GREEN.

**Checkpoint**: US3 GREEN. US1 + US2 + US3 셋 다 독립 동작.

---

## Phase 6: User Story 4 - 5회 실패 + 30분 잠금 (Priority: P4)

**Goal**: 같은 계정에 비밀번호 시도 5회 누적 실패 시 다음 30분간 잠금. 30분 만료 후 자동 해제. 성공 시 카운트 초기화.

**Independent Test**: 자동 회귀로 `LoginAttemptServiceIT` 4 케이스 + `LoginAttemptFilter` Web 테스트 GREEN.

### Service + Filter (TDD HARD-GATE — 4 회귀 케이스 의무)

- [ ] T054 [US4] `LoginAttemptService.kt` 신설 + 통합 테스트 — `backend/src/main/kotlin/com/writenote/service/LoginAttemptService.kt` (`recordFailure(email)` / `recordSuccess(email)` / `isLocked(email)` — 모두 `@Lock(LockModeType.PESSIMISTIC_WRITE)` 로 user row 갱신, FR-038). 테스트: `backend/src/test/kotlin/com/writenote/service/LoginAttemptServiceIT.kt` (4 회귀 케이스: 5회 실패 → 6번째 잠금 / 잠금 만료 후 통과 / 4회 실패 후 성공 시 카운트 초기화 / 동시 실패 결정성). T018 의존. TDD HARD-GATE
- [ ] T055 [US4] `LoginAttemptFilter.kt` 신설 — `backend/src/main/kotlin/com/writenote/auth/LoginAttemptFilter.kt` (URL = `POST /api/auth/login` 한정. Request body 의 email 추출 — body 1회만 읽기 → cache. `LoginAttemptService.isLocked()` 통과 시 다음 필터, 잠금 시 401 + LOGIN_LOCKED + AuthErrorEntryPoint 통해 envelope 응답). T054 의존
- [ ] T056 [US4] `SecurityConfig.kt` 갱신 — `LoginAttemptFilter` 를 `JwtAuthenticationFilter` 앞 위치에 등록 (contracts/security-filter-chain.md §1)

### AuthService 결선 + Web 테스트

- [ ] T057 [US4] `AuthService.login()` 갱신 — 성공 시 `loginAttemptService.recordSuccess()`, 실패 시 `loginAttemptService.recordFailure()` 호출. 5회 도달 시 `lockout_until = now() + 30min` 박음. T038/T054 의존
- [ ] T058 [US4] Filter Web 테스트 — `backend/src/test/kotlin/com/writenote/controller/LoginLockoutWebTest.kt` (5회 실패 → 6번째 LOGIN_LOCKED 응답 + envelope 정합)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*LoginAttempt*" --tests "*Lockout*" :backend:ktlintMainSourceSetCheck` GREEN.

**Checkpoint**: US4 GREEN. SC-005 (4 자동 회귀 케이스 GREEN) 달성.

---

## Phase 7: User Story 5 - 이메일 ↔ 카카오 추가 연결 (Priority: P5)

**Goal**: 이메일·비밀번호 로그인 사용자가 카카오 추가 연결 가능. 카카오 가입 사용자가 비밀번호 추가 등록 가능. 충돌 (이미 묶인 카카오 식별자) 거부.

**Independent Test**: 자동 회귀로 `AccountLinkServiceIT` GREEN + Web 테스트 GREEN.

### DTO + Service (TDD HARD-GATE)

- [ ] T059 [P] [US5] 연결 DTO 2종 — `backend/src/main/kotlin/com/writenote/model/request/LinkEmailRequest.kt` (`password` 만), `LinkKakaoStateRequest.kt` (state 분기용 내부 모델)
- [ ] T060 [US5] `AccountLinkService.kt` 신설 + 통합 테스트 — `backend/src/main/kotlin/com/writenote/service/AccountLinkService.kt` (`linkEmail(userId, password)` + `linkKakao(userId, kakaoUserInfo)` — `KakaoConflictChecker` 호출). 테스트: `backend/src/test/kotlin/com/writenote/service/AccountLinkServiceIT.kt` (linkEmail happy / 이미 비밀번호 설정됨 / 약한 비밀번호 거부 / linkKakao happy / 다른 사용자에 묶인 카카오 식별자 거부, 5 케이스). T042/T024 의존

### Kakao OAuth 추가 연결 분기

- [ ] T061 [US5] `KakaoOAuth2UserService.kt` 갱신 — `state` 파라미터 분기: state 가 추가 연결 시그널 포함 시 본인 user 의 `kakao_id` UPDATE (`AccountLinkService.linkKakao()` 위임). T043/T060 의존

### Controller + Security

- [ ] T062 [US5] `AuthController.kt` 갱신 — `POST /api/auth/link/kakao` (302 redirect + state) + `POST /api/auth/link/email` 2 endpoint. T060 의존
- [ ] T063 [US5] `SecurityConfig.kt` 갱신 — 두 endpoint 보호 (JWT 필수)

### Web 테스트

- [ ] T064 [US5] Web 테스트 — `backend/src/test/kotlin/com/writenote/controller/AccountLinkWebTest.kt` (linkEmail happy / PASSWORD_ALREADY_SET 충돌 / linkKakao state 분기 / KAKAO_ALREADY_LINKED 충돌, 4 케이스)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*AccountLink*" --tests "*Link*" :backend:ktlintMainSourceSetCheck` GREEN.

**Checkpoint**: US5 GREEN. 본인이 환경별 다른 진입 방법으로 같은 계정 도달 가능.

---

## Phase 8: User Story 6 - 본인 정보 조회 + 임시 owner 헤더 정리 (Priority: P6)

**Goal**: `GET /api/auth/me` 응답 완성 (kakao 연결 여부 / 이메일 인증 시각 / 활성 모바일 캡처 토큰 수 0). 001 의 임시 `X-User-Id` 헤더 owner 식별 제거 → `@AuthenticationPrincipal AuthenticatedPrincipal` 교체.

**Independent Test**: SC-008 의 `grep -rn "X-User-Id" backend/src/main/` 결과 0 line + `ProjectControllerOwnerCleanupTest` GREEN.

### /api/auth/me 마무리

- [ ] T065 [US6] `UserAuthConverter.kt` 갱신 — `kakaoLinked = (user.kakaoId != null)` + `activeApiTokenCount = 0` (Week 4 의 ApiToken 테이블 미존재 → 0 고정. data-model.md / auth-endpoints.md §10). T037 갱신

### Project Controller owner context 교체

- [ ] T066 [US6] `ProjectController.kt` 갱신 — `backend/src/main/kotlin/com/writenote/controller/ProjectController.kt` 의 6 endpoint 모두 `@RequestHeader("X-User-Id") userId: Long` → `@AuthenticationPrincipal principal: AuthenticatedPrincipal` 교체. service 호출 시 `principal.userId` 전달. contracts/owner-context-migration.md §2
- [ ] T067 [US6] 기존 `ProjectControllerWebTest.kt` 갱신 — `backend/src/test/kotlin/com/writenote/controller/ProjectControllerWebTest.kt` 의 mock 호출 시 `X-User-Id` 헤더 주입 → JWT 헤더 주입 (`@WithMockUser` 또는 MockMvc 의 `header("Authorization", "Bearer ...")` 패턴) 교체
- [ ] T068 [US6] 회귀 테스트 신설 — `backend/src/test/kotlin/com/writenote/controller/ProjectControllerOwnerCleanupTest.kt` (contracts/owner-context-migration.md §4 의 5 케이스: 인증 호출 GREEN / 비인증 401 / X-User-Id 헤더 변조 무시 / 다른 사용자 리소스 404 / DTO owner 필드 변조 무시). T066 의존
- [ ] T069 [US6] DTO 정리 — `CreateProjectRequest` / `UpdateProjectRequest` 의 `userId` 필드가 존재하면 제거. owner 는 principal 에서만 도출 (contracts/owner-context-migration.md §4)
- [ ] T070 [US6] SC-008 검증 — `grep -rn "X-User-Id" backend/src/main/` 결과 0 line 확인. 만약 존재 시 제거 + 본 task 완료 박음

### Security 갱신

- [ ] T071 [US6] `SecurityConfig.kt` 갱신 — `/api/projects/**` 명시 보호 endpoint 로 박음 (현재 baseline 가 permit-all 이라면 본 task 에서 보호로 전환)

**🛑 회귀 게이트**: `./gradlew :backend:test --tests "*ProjectController*" --tests "*OwnerCleanup*" :backend:ktlintMainSourceSetCheck` GREEN + `grep -rn "X-User-Id" backend/src/main/` 0 line.

**Checkpoint**: US6 GREEN. 001 의 임시 헤더 완전 제거. 본 spec 의 모든 user story 독립 동작.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 일일 청소 + OpenAPI 문서 + profile 정합 + 마이그레이션 적용 + dogfooding + docs 갱신 + 회고 + 단일 검증 게이트

- [ ] T072 [P] `TokenCleanupService.kt` 신설 + 단위 테스트 — `backend/src/main/kotlin/com/writenote/service/TokenCleanupService.kt` `@Scheduled(cron = "0 0 0 * * *")` (매일 자정) → `AuthTokenRepository.cleanupExpiredAndUsed(now)` 호출. 테스트: `backend/src/test/kotlin/com/writenote/service/TokenCleanupServiceTest.kt` (Repository mock + 호출 검증). T022 의존, data-model.md §5
- [ ] T073 [P] OpenAPI documentation 보강 — `AuthController.kt` 의 12 endpoint 에 `@Tag` / `@Operation` / `@ApiResponse` / `@Schema` annotation 추가 (`~/.claude/rules/java/spring/api-contract.md`)
- [ ] T074 [P] `application*.yml` profile 마무리 — local/test/prod 각 profile 의 `spring.flyway` / `spring.datasource` / `spring.security.oauth2` / `spring.mail` / `app.auth.jwt` 정합 확인
- [ ] T075 V3 + V4 마이그레이션 적용 컨펌 + dogfooding — 사용자 명시 컨펌 받은 후 로컬 docker postgres 에 적용 (`docker compose up -d --wait postgres` + `./gradlew :backend:bootRun --args='--spring.profiles.active=local'`). 적용 후 `\d users` / `\d auth_tokens` 로 확인. quickstart.md §4
- [ ] T076 본인 dogfooding 진입 — quickstart.md §6 의 12 endpoint curl 흐름 (US1 ~ US5) 본인 시도 + 의외 발견 사항 즉시 issue 박음
- [ ] T077 [P] `docs/plan/02-progress.md` 갱신 — §1 Phase 1B Backend Auth Foundation 완료 entry + commit hash + §3 다음 진입점 = Week 2 (Project/Character CRUD 확장) 또는 002 dogfooding 마무리
- [ ] T078 [P] `docs/plan/03-backend-requirements.md` §6 변경 이력 — 본 spec 구현 중 의외 결정 발견 시 행 추가 (없으면 skip)
- [ ] T079 5축 회고 작성 — `docs/retrospectives/2026-MM-DD-phase-1b-backend-auth.md` (`.claude/skills/retrospective/SKILL.md` 가 정의한 5축: 무엇/어떻게/잘된점/어긋난점/교훈). 룰 갱신 후보 §5-2 박음
- [ ] T080 단일 검증 게이트 GREEN (SC-009) — `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` 1 회. 본 명령 GREEN 이 본 spec 의 자동화 완료 신호

**🛑 본 spec 완료**: T080 GREEN + T075 적용 + T076 dogfooding 진행 후 commit + develop merge + 진행 보고.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능 (의존성 없음).
- **Foundational (Phase 2)**: Setup 완료 후 시작. **모든 user story 블로킹**. 본 phase 내부 의존:
    - T006/T007/T008/T009/T010 (Config 빈) → 독립
    - T011~T015 (에러 코드 / 핸들러) → T013 → T014 / T013 → T015
    - T016/T017/T018 (Users 확장) → T016 → T017 / T018, T018 → T019
    - T020/T021/T022 (AuthToken) → T020 → T021 / T020 → T022, T022 → T023
    - T024~T027 (Component) → 독립 (T027 은 T006 의존)
    - T028~T031 (Principal + 필터 + SecurityConfig) → T028 독립, T029 는 T006/T028, T030 독립, T031 은 T009/T015/T029/T030
    - T032 (OpenApi) 독립
- **User Story 1 (Phase 3, P1) MVP**: Foundational 완료 후 시작. 본 phase 끝나면 본 spec 의 1차 dogfooding 가능 시점.
- **User Story 2 (Phase 4, P2)**: US1 의 AuthService (`T038`) 의존 (`OAuth2SuccessHandler` 가 JWT 발급에 의존).
- **User Story 3 (Phase 5, P3)**: Foundational 완료 후 독립 시작 가능. US1/US2 와 병행 가능.
- **User Story 4 (Phase 6, P4)**: US1 의 `AuthService.login()` (T038) 의존 (T057 갱신).
- **User Story 5 (Phase 7, P5)**: US1 (`/api/auth/me` 보호 endpoint) + US2 (`KakaoOAuth2UserService`) 의존.
- **User Story 6 (Phase 8, P6)**: US1 의 `AuthenticatedPrincipal` + `JwtAuthenticationFilter` (T028/T029) 의존. ProjectController 수정은 다른 US 와 독립.
- **Polish (Phase 9)**: 모든 phase 완료 후. T075/T076/T077/T079/T080 은 순차 (75 → 76 → 77 → 79 → 80).

### User Story 의존 그래프

```
        ┌─→ US1 (P1, MVP) ──┬─→ US2 (P2)
        │                   ├─→ US3 (P3, 병행)
Foundational                ├─→ US4 (P4, AuthService 갱신)
        │                   ├─→ US5 (P5, US2 결선)
        │                   └─→ US6 (P6, principal 적용)
        └─→ US3 (병행 시작 가능, Foundational만 의존)
```

### Within Each User Story

- TDD HARD-GATE: 도메인 로직 task 는 RED → GREEN. 테스트 먼저 fail 확인 후 구현. 본 spec 의 TDD 영역:
  - T024 PasswordPolicyValidator
  - T025 AuthTokenGenerator
  - T026 AuthTokenLifecycleManager
  - T027 JwtTokenProvider
  - T038 AuthService (US1)
  - T042 KakaoConflictChecker (US2)
  - T043 KakaoOAuth2UserService (US2)
  - T050 PasswordResetService (US3)
  - T054 LoginAttemptService (US4) — 4 회귀 케이스 의무
  - T060 AccountLinkService (US5)
  - T068 ProjectControllerOwnerCleanupTest (US6)
- DTO → Service → Controller → Web 테스트 순.
- 라운드별 검증 명령 2개 이하 (좁은 테스트 + ktlint). 전체 빌드는 T080 에서 1회.

### Parallel Opportunities

- Setup phase T002/T003/T004/T005 [P] 병렬 (다른 파일).
- Foundational phase 의 Config 빈 (T006~T010) [P] 병렬.
- Foundational phase 의 enum (T011/T012) [P] 병렬.
- Component (T024/T025/T026) [P] 병렬 (서로 독립).
- DTO task 들 (T033/T034/T035, T047/T048, T059) [P] 병렬.
- Polish phase T072/T073/T074 [P] 병렬.
- US3 와 US1 는 Foundational 완료 후 병렬 시작 가능 (단일 개발자라면 우선순위에 따라 순차).

---

## Parallel Example: Foundational Phase Config 빈

```bash
# Foundational phase 진입 시 다음 4 task 병렬 가능 (서로 다른 파일, 의존 없음):
Task: "JwtConfig.kt + JwtTokenProvider 빈 신설 (T006)"
Task: "MailConfig.kt + MailSenderPort 인터페이스 + LoggingMailSender 신설 (T007)"
Task: "OAuth2Config.kt 카카오 ClientRegistration 신설 (T008)"
Task: "CorsConfig.kt 갱신 — V1 와일드카드 정책 (T009)"
```

```bash
# US1 의 DTO 작성도 병렬 가능:
Task: "Request DTO 5종 (T033) — signup-email / verify-email / login / refresh / logout"
Task: "Response DTO (T034) — TokenPair / AuthMe / SignupEmail"
Task: "EmailVerificationRequestedEvent (T035)"
```

---

## Implementation Strategy

### MVP First (User Story 1 만)

1. Setup (Phase 1) 완료 — 의존성 / 환경 변수 골격
2. Foundational (Phase 2) 완료 — 두 엔티티 + Config + Component + 필터 + Security baseline (V3/V4 적용 컨펌 포함)
3. US1 (Phase 3) 완료 — 이메일·비밀번호 회원가입 + 로그인 + JWT 갱신
4. **STOP and VALIDATE**: quickstart §6-1 본인 dogfooding GREEN. US1 만으로도 작가 본인이 자신의 계정으로 로그인 → 보호 endpoint 진입 가능. Phase 3 종료 시점에 commit + develop merge 검토.

### 본 spec 전체 진입 순서 권장 (1차 사용자 = 본인 1명 V1)

1. Setup → Foundational → US1 (MVP)
2. US3 (비밀번호 재설정) — US1 dogfooding 중 본인이 비밀번호 잊는 첫 회귀 시점에 자연 합류
3. US4 (5회 잠금) — 보안 회귀를 외부 노출 전에 박음
4. US2 (카카오 OAuth) — 본인이 카카오 콘솔 등록 시점에 합류 (외부 의존 작업)
5. US5 (이메일 ↔ 카카오 추가 연결) — US2 완료 후 자연 합류
6. US6 (본인 정보 조회 + owner 정리) — 다른 US 가 모두 박힌 후 마무리. 임시 헤더 cleanup 의 자연 시점.
7. Polish — T080 단일 검증 게이트 GREEN

### 단일 개발자 (본인) 진행 — Subagent 위임 여부

`~/.claude/rules/shared/subagent-delegation-cost.md` 게이트 3 질문 적용 결과 (research.md R-12 결정 표 정합):

| Phase | 직접 vs 위임 |
|---|---|
| Setup (T001~T005) | 직접 (단순 설정) |
| Foundational Config/Repository (T006~T023) | 직접 (단일 파일 단위) |
| Foundational Component (T024~T027) | 직접 (각 ~100 LOC + 단위 테스트) |
| Foundational 필터 (T028~T032) | 직접 (시그니처 명확) |
| US1 AuthService + Controller (T038~T041) | 위임 검토 (5 endpoint + TDD HARD-GATE + 라운드 의존) |
| US2 (T042~T046) | 위임 검토 (외부 의존 mock + 다중 분기 + TDD) |
| US3 (T047~T053) | 직접 또는 위임 (단일 흐름) |
| US4 (T054~T058) | 위임 검토 (잠금 동시성 + 4 회귀 케이스 TDD) |
| US5 (T059~T064) | 위임 검토 (다중 분기 + OAuth 결선) |
| US6 (T065~T071) | 직접 (시그니처 교체 + 회귀 테스트) |
| Polish (T072~T080) | 직접 (운영 / 문서 / 검증) |

위임 dispatch prompt 의무 항목 (`subagent-delegation-cost.md` §"Dispatch Prompt 체크리스트"):
- 라운드별 검증 명령 2 개 이하 (좁은 테스트 + ktlint)
- commit 금지 (orchestrator 가 라운드 묶어서 commit)
- tool_uses 50 cap
- 같은 에러 3회 재시도 금지

---

## Notes

- [P] tasks = 다른 파일, 미완 의존 없음
- [Story] label = US1~US6 매핑 (Setup / Foundational / Polish 는 label 없음)
- 각 user story 는 독립 완결 + 독립 테스트 가능
- TDD 영역은 RED 테스트 fail 확인 후 GREEN 구현
- 각 task 단위 또는 phase 단위 commit (`docs/plan/00-stack §8` cycle)
- 외부 DB 쓰기 (V3/V4 적용) 는 사용자 명시 컨펌 후 (T075)
- 검증 명령은 좁게 시작 → 마지막 T080 에서 전체 1 회
- DB 측 default / 트리거 / 생성 컬럼 검증은 `EntityManager.flush() + clear()` 패턴 의무 (`jpa-test-patterns.md`)
- `any()` matcher 금지 — 식별자 / 코드 / payload 는 `eq()` / `match {}` (`testing-strategy.md`)
- 운영 신호 (health check / log warning) 끄지 말 것 (`observability-signals.md`)
- 본 tasks.md 는 `/speckit-implement` 의 입력. 구현 진입 시 본 task list 위에서 라운드 분해 + 순서 결정
