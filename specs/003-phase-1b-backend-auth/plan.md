# Implementation Plan: Phase 1B Backend Auth Foundation

**Branch**: `003-phase-1b-backend-auth` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-phase-1b-backend-auth/spec.md`

## Summary

001 의 Phase 1A 백엔드 골격 위에 **Week 1B 백엔드 인증 전체** 를 박는다. 산출물: SoT `docs/plan/03-backend-requirements.md` §3-2 의 12 인증·사용자 endpoint + §4 의 인증/인가 정책 (JWT + Kakao OAuth + BCrypt + 3 분리 필터 체인 + CORS + 401 5종 코드) + §2-2 의 `Users`/`AuthToken` 두 엔티티 (`Users` 확장 + `AuthToken` 신설) + 001 의 임시 `X-User-Id` 헤더 owner 식별 제거 → 인증된 principal 기반 교체. 본 spec 은 **백엔드 한정** 으로, 인증 화면(`/auth/<panel>`) 의 프론트 결선은 본 spec 의 dogfooding GREEN 이후 별도 진행한다.

## Technical Context

**Language/Version**: Kotlin 2.2.21 on Java 24 toolchain (시스템 host = Corretto 25 — `docs/plan/00-stack §2-1`).

**Primary Dependencies** (기존 001 의존성 위에 신규 추가):
- 기존: `org.springframework.boot:spring-boot-starter-{web,security,data-jpa,validation,actuator}` 4.0.6, Flyway, springdoc-openapi, ktlint, Checkstyle, PostgreSQL JDBC, Testcontainers.
- 신규(본 spec 진입 시 추가):
  - `org.springframework.boot:spring-boot-starter-oauth2-client` — 카카오 OAuth2 (SoT §4-2 명시)
  - `org.springframework.boot:spring-boot-starter-mail` — 메일 발송 추상화 (`JavaMailSender`)
  - `io.jsonwebtoken:jjwt-api`/`jjwt-impl`/`jjwt-jackson` 0.12.x — JWT 발급·검증 (HS256, SoT §4-1)
  - Spring Security 의 `BCryptPasswordEncoder` (기존 `spring-boot-starter-security` 에 포함)

**Storage**:
- 영속: PostgreSQL (Supabase Postgres prod / 로컬 docker `postgres:17-alpine`)
- 본 spec 의 새 마이그레이션:
  - `V3__expand_users_for_auth.sql` — `users` 에 카카오 식별자 / 비밀번호 해시 / 이메일 인증 시각 / 마지막 로그인 시각 / 누적 실패 횟수 / 잠금 만료 시각 / `updated_at` 컬럼 추가 + 인덱스
  - `V4__create_auth_tokens.sql` — `auth_tokens` 통합 테이블 (type ENUM, token_hash UNIQUE, expires_at, used_at, created_at) + 인덱스
- 토큰 보조 테이블에 평문 저장 금지 — 모든 토큰은 SHA-256 해시로만 저장 (SoT §2-2 + spec FR-033)
- 갱신 토큰: 같은 `auth_tokens` 테이블에 `type=REFRESH` 행으로 보관 → 로그아웃 시 즉시 행 삭제

**Testing**:
- 단위: JUnit 5 + AssertJ + MockK. `any()` matcher 금지 — 정확값 (`eq()` / `match { }`) (`~/.claude/rules/shared/testing-strategy.md`)
- 통합: Spring Boot Test + Testcontainers (PostgreSQL 17). 본 spec 신설 영역은 JPA 1차 캐시 우회 의무 패턴 적용 (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md` — `EntityManager.flush() + clear()` 후 SELECT)
- 비밀번호 정책 / 5회 잠금 / 토큰 일회용 / Kakao 충돌 흐름 / owner context 교체는 **TDD HARD-GATE** (`~/.claude/rules/shared/testing-strategy.md` §HARD-GATE)
- 검증 게이트: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` 단일 명령 GREEN (SC-009)
- 단기 커버리지 게이트: 신규 코드 60%+ (SC-011)

**Target Platform**: Render web service (Linux, 무료 plan) + 로컬 dev (macOS Darwin 25). cold start 30 초+ 감내 (`docs/plan/00-stack §2-3`).

**Project Type**: Monorepo web application — 본 feature 는 `backend/` 만 변경. `frontend/`, `docker-compose.yml`, `docs/plan/00-stack-and-schedule.md`, `docs/plan/01-phase-breakdown.md` 변경 없음. `docs/plan/02-progress.md` 는 본 spec 완료 시점에 §1 / §3 갱신.

**Performance Goals**: 본인 정보 조회 p95 < 1s (SC-010, 단일 사용자 환경). 로그인 / 토큰 갱신 / 인증 endpoint 응답 시간 정량 목표는 V1 = 단일 사용자라 별도 SLO 없음 — Render free plan cold start 30 초+ 가 본 spec 범위 외 (`docs/plan/00-stack §2-3`).

**Constraints**:
- **외부 인프라 안전 (HARD-GATE)**: `.claude/rules/infra/external-infra-safety.md` 적용. 본 spec 의 두 마이그레이션(`V3`, `V4`) **작성·리뷰는 OK, 적용은 사용자 명시 컨펌 후만 가능**. `.env*` Read / 시크릿 echo / 이전 세션 자격증명 재투입 금지.
- **OAuth 외부 콘솔**: 카카오 OAuth redirect URI / 클라이언트 ID·시크릿은 외부 콘솔에서 사전 등록. 본 spec 은 환경 변수 로딩만 가정 (spec.md Assumptions).
- **JWT 시크릿**: `JWT_SECRET` 환경 변수에서 로딩, 소스에 포함 금지 (`~/.claude/rules/shared/security.md`).
- **Trans-tx 외부 호출**: 메일 발송, 카카오 API 호출은 데이터베이스 트랜잭션 외부에서 수행 (FR-035, `~/.claude/rules/kotlin/spring/spring-patterns.md` §"외부 API 호출은 반드시 트랜잭션 밖").
- **`@Transactional` + 이벤트**: `publishEvent` 사용 메서드는 `@Transactional(rollbackFor = Exception::class)` 의무 — 본 spec 은 메일 발송 트리거가 이벤트 기반일 경우 적용.
- **모든 연관관계 `LAZY`**: JPA 엔티티 `FetchType.EAGER` 금지 (`~/.claude/rules/java/spring/jpa-mongodb.md`).
- **Subagent 비용 인식**: 본 spec 의 phase 분해 시 LOC 200 이하 라운드는 직접 수행, 다중 분기·cross-BC·라운드 의존이 있는 라운드만 위임 검토 (`~/.claude/rules/shared/subagent-delegation-cost.md`).

**Scale/Scope**:
- 1차 사용자 = 본인 1명 V1 dogfooding (`DESIGN.md §전제` + `docs/plan/03-backend §1-2`)
- 본 spec 의 endpoint = 12 개 + 3 분리 필터 + 2 신설/확장 엔티티
- 코드 LOC 추정 = controller (12 endpoint) + service (6~8 클래스) + component (Validator / Checker / Converter 약 5~7) + repository (2 신설 + 1 확장) + entity (1 신설 + 1 확장) + config (Security + OAuth + Mail + JWT) + filter (3) + DTO (~30) + 마이그레이션 SQL 2 + 자동 회귀 테스트 (단위 + 통합 ~25~35). 총 ~3000~4500 LOC 추정. multi-round-implementation.md 의 "10+ task / 다중 BC / TDD 의무" 영역 → 라운드 분해 의무.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 default placeholder. 본 feature 의 effective gates 는 프로젝트 SoT + 글로벌·프로젝트 룰에서 도출:

- **Backend SoT gate**: 본 spec 의 모든 정책 결정은 `docs/plan/03-backend-requirements.md` (백엔드 통합 SoT) 인용 의무. 결정이 SoT 에 없으면 spec.md Assumptions 또는 research.md 에 박힌 default 로 진행 + 변경 발생 시 SoT §6 변경 이력에 행 추가 (SoT §7).
- **Context persistence gate**: 본 spec 의 모든 산출물 (spec / plan / research / data-model / contracts / quickstart / checklists) 을 `specs/003-phase-1b-backend-auth/` 에 박는다. 루트 `CLAUDE.md` 의 SPECKIT 마커를 본 plan 으로 갱신.
- **External infra safety gate (HARD-GATE)**: `.claude/rules/infra/external-infra-safety.md` 적용. `V3`/`V4` 마이그레이션 작성·리뷰 OK, **적용(`./gradlew flywayMigrate` 또는 boot 시 자동 마이그레이션)은 사용자 명시 컨펌 후만 가능**. `.env*` Read / `DATABASE_URL`·`JWT_SECRET`·`KAKAO_*` echo / 이전 세션 자격증명 재투입 금지.
- **Quality gate**: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` 단일 명령 GREEN 의무. line 120 자 / no wildcard import / ktlint_official style.
- **TDD HARD-GATE**: 비밀번호 정책(FR-002), 5회 잠금(FR-013/014/015), 토큰 일회용(FR-006/018), 카카오 충돌 흐름(FR-022/025), owner context 교체(FR-027/028) 등 도메인 분기 / 매핑 / 상태 전이 영역은 RED → GREEN 의무 (`~/.claude/rules/shared/testing-strategy.md`).
- **JPA 1차 캐시 우회 의무 패턴**: `Users`/`AuthToken` Repository 통합 테스트는 `EntityManager.flush() + clear()` 후 `findById` (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md`). DB DEFAULT (`updated_at`, `created_at`) / CHECK / UNIQUE 위반 검증 의무.
- **Subagent dispatch cost gate**: phase 분해 시 LOC > 200 + 다중 분기 + 라운드 의존 라운드만 위임 검토. dispatch prompt 에 (a) 라운드별 검증 명령 2 개 이하 (b) commit 금지 (orchestrator 가 묶어서 commit) (c) tool_uses 50 cap (d) 같은 에러 3 회 재시도 금지 명시 (`~/.claude/rules/shared/subagent-delegation-cost.md`).
- **API contract gate**: 모든 응답은 `Result<T>` envelope (success/data 또는 success/error.code/error.message) 통일 (FR-036, 001 에서 박힘). DTO 네이밍 `Create{Entity}Request` / `Update{Entity}Request` / `{Entity}Response` (`~/.claude/rules/java/spring/api-contract.md`).
- **JPA fetch 정책**: 모든 연관관계 `LAZY`, `FetchType.EAGER` 금지. `findAll()` 무제한 호출 금지 — `Pageable` 의무.
- **트랜잭션 정책**: 쓰기 `@Transactional(rollbackFor = Exception::class)`, 읽기 `@Transactional(readOnly = true)`. 외부 API (카카오) / 메일 발송은 트랜잭션 외부. `publishEvent` 호출 메서드는 `@Transactional` 의무 (`~/.claude/rules/java/spring/spring-patterns.md`).
- **Owner context cleanup gate**: 본 spec 완료 시점에 임시 `X-User-Id` 헤더의 런타임 사용처 0 건 (SC-008). 인증된 principal 기반 ownership 으로 교체 (FR-027/028).
- **Phase 분해 정합 gate**: 본 spec 의 12 endpoint × §4 정책 매트릭스를 1B-1 ~ 1B-6 (각 1.5~3시간) phase 단위로 분해. plan 의 라운드 분해 가이드는 `multi-round-implementation.md` 의 "10+ task / 다중 BC / TDD 의무" 영역 정합.

**Initial gate status: PASS**. Complexity Tracking 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/003-phase-1b-backend-auth/
├── spec.md                          # /speckit-specify 결과 (6 User Story + 38 FR + 12 SC)
├── plan.md                          # 본 파일 (/speckit-plan)
├── research.md                      # Phase 0 — 결정 + 근거 + 대안
├── data-model.md                    # Phase 1 — Users 확장 + AuthToken 신설 + 마이그레이션 SQL 스케치
├── quickstart.md                    # Phase 1 — 로컬 dogfooding 진입 절차
├── contracts/
│   ├── auth-endpoints.md            # SoT §3-2 의 12 endpoint request/response/error 매트릭스
│   ├── security-filter-chain.md     # 3 분리 필터 + 공개/보호 endpoint 매핑 + 401 5종 코드
│   ├── token-formats.md             # JWT payload + 보조 토큰 형식 + 만료 정책
│   └── owner-context-migration.md   # 001 의 X-User-Id 제거 + principal 기반 교체 흐름
└── checklists/
    └── requirements.md              # /speckit-specify 단계 산출 (모두 ✓)
```

### Source Code (repository root)

```text
backend/
├── build.gradle.kts                                 # 의존성 추가 (oauth2-client / mail / jjwt)
├── settings.gradle.kts                              # 변경 없음
├── src/
│   ├── main/
│   │   ├── kotlin/com/writenote/
│   │   │   ├── BackendApplication.kt                # 변경 없음
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.kt                # ★ 본 spec 에서 인증 필터 체인 본격 구성 (기존 permit-all baseline 교체)
│   │   │   │   ├── OAuth2Config.kt                  # ★ 신설 — 카카오 ClientRegistrationRepository (env 기반)
│   │   │   │   ├── CorsConfig.kt                    # 본 spec 갱신 — V1 와일드카드 정책 + 허용 헤더 확장
│   │   │   │   ├── JwtConfig.kt                     # ★ 신설 — JwtTokenProvider 빈 + 시크릿 로딩 + 만료 정책
│   │   │   │   ├── MailConfig.kt                    # ★ 신설 — JavaMailSender 빈 + profile 별 구현 (local=log / prod=SMTP)
│   │   │   │   └── OpenApiConfig.kt                 # 본 spec 갱신 — 보안 schema(JWT/ApiToken) 표기
│   │   │   ├── auth/                                # ★ 신설 — 인증 cross-cutting 컴포넌트
│   │   │   │   ├── JwtTokenProvider.kt              # 발급/검증/parsing
│   │   │   │   ├── JwtAuthenticationFilter.kt       # Bearer eyJ* 검증 필터
│   │   │   │   ├── ApiTokenAuthenticationFilter.kt  # Bearer wnt_* 검증 필터 (POST /api/capture 한정)
│   │   │   │   ├── LoginAttemptFilter.kt            # POST /api/auth/login URL 만 매칭 — 잠금 검증
│   │   │   │   ├── KakaoOAuth2UserService.kt        # OAuth2UserService 커스텀 — Kakao 응답 → user 생성/조회
│   │   │   │   ├── OAuth2SuccessHandler.kt          # JWT 발급 + URL fragment redirect
│   │   │   │   ├── AuthenticatedPrincipal.kt        # @AuthenticationPrincipal 추출용 record
│   │   │   │   └── PasswordEncoderConfig.kt         # BCryptPasswordEncoder (cost 12) 빈
│   │   │   ├── controller/
│   │   │   │   ├── AuthController.kt                # ★ 신설 — 12 endpoint (signup/verify/login/refresh/logout/me/oauth/link/reset)
│   │   │   │   └── ProjectController.kt             # 본 spec 수정 — X-User-Id 헤더 제거 + @AuthenticationPrincipal 사용
│   │   │   ├── service/
│   │   │   │   ├── AuthService.kt                   # ★ 신설 — 회원가입/로그인/토큰 발급/갱신/로그아웃 트랜잭션 경계
│   │   │   │   ├── EmailVerificationService.kt      # ★ 신설 — 이메일 인증 토큰 발급/검증
│   │   │   │   ├── PasswordResetService.kt          # ★ 신설 — 재설정 토큰 발급/검증/변경
│   │   │   │   ├── AccountLinkService.kt            # ★ 신설 — 이메일 ↔ 카카오 추가 연결
│   │   │   │   ├── LoginAttemptService.kt           # ★ 신설 — 잠금 카운트 / lockout_until row-level
│   │   │   │   ├── TokenCleanupService.kt           # ★ 신설 — @Scheduled 일일 청소 (만료 + used 비-refresh)
│   │   │   │   └── ProjectService.kt                # 본 spec 수정 — owner 파라미터 → AuthenticatedPrincipal.userId
│   │   │   ├── components/                          # ★ 신설 — Service 비대화 방지
│   │   │   │   ├── PasswordPolicyValidator.kt       # 12자 + 영문/숫자/특수 검증
│   │   │   │   ├── EmailFormatValidator.kt          # 이메일 형식 검증 (Hibernate Validator 위에 도메인 메시지)
│   │   │   │   ├── AuthTokenGenerator.kt            # 무작위 32 바이트 → base64url + SHA-256 해시 페어 생성
│   │   │   │   ├── KakaoConflictChecker.kt          # 카카오 식별자 충돌 / 이메일 충돌 분기 결정
│   │   │   │   ├── AuthTokenLifecycleManager.kt     # used_at 갱신 / 만료 검증 / 재사용 거부
│   │   │   │   └── UserAuthConverter.kt             # User entity ↔ AuthMeResponse 변환
│   │   │   ├── repository/
│   │   │   │   ├── UserRepository.kt                # 본 spec 수정 — kakaoId / failedLoginCount 등 쿼리 추가
│   │   │   │   └── AuthTokenRepository.kt           # ★ 신설 — type + tokenHash 조회 / 만료 청소 쿼리
│   │   │   ├── entity/
│   │   │   │   ├── User.kt                          # ★ 본 spec 확장 — kakaoId / passwordHash / emailVerifiedAt / lastLoginAt / failedLoginCount / lockoutUntil / updatedAt
│   │   │   │   ├── AuthToken.kt                     # ★ 신설 — 통합 보조 토큰
│   │   │   │   └── Project.kt                       # 변경 없음 (owner FK 만 살리고 owner 식별 메커니즘이 위에서 교체됨)
│   │   │   ├── enums/
│   │   │   │   ├── AuthTokenType.kt                 # ★ 신설 — EMAIL_VERIFY / PASSWORD_RESET / REFRESH
│   │   │   │   └── AuthErrorCode.kt                 # ★ 신설 — AUTH_TOKEN_MISSING / INVALID / EXPIRED / REVOKED / LOGIN_LOCKED / PASSWORD_TOO_WEAK / ...
│   │   │   ├── model/
│   │   │   │   ├── request/                         # ★ 신설 — Create*Request / *Request 다수
│   │   │   │   │   ├── SignupEmailRequest.kt
│   │   │   │   │   ├── VerifyEmailRequest.kt
│   │   │   │   │   ├── LoginRequest.kt
│   │   │   │   │   ├── RefreshTokenRequest.kt
│   │   │   │   │   ├── PasswordResetRequestRequest.kt
│   │   │   │   │   ├── PasswordResetConfirmRequest.kt
│   │   │   │   │   ├── LinkKakaoRequest.kt
│   │   │   │   │   └── LinkEmailRequest.kt
│   │   │   │   └── response/
│   │   │   │       ├── TokenPairResponse.kt         # access + refresh + 만료
│   │   │   │       ├── AuthMeResponse.kt            # 본인 정보 (FR-026)
│   │   │   │       └── EmptyDataResponse.kt         # success-only endpoint 용
│   │   │   ├── error/                               # 본 spec 갱신 — 인증 도메인 예외 + 핸들러 401 5 코드 매핑
│   │   │   │   ├── ApiException.kt                  # (기존)
│   │   │   │   ├── GlobalExceptionHandler.kt        # ★ 본 spec 확장 — 인증 예외 매핑
│   │   │   │   └── AuthException.kt                 # ★ 신설
│   │   │   └── mapper/
│   │   │       └── (entity ↔ DTO 매퍼)               # 기존 + 본 spec 신설
│   │   └── resources/
│   │       ├── application.yml                      # 본 spec 갱신 — spring.security.oauth2.client.{registration,provider}.kakao / spring.mail
│   │       ├── application-local.yml                # 로컬 — mail = log impl, oauth secrets = placeholder env
│   │       ├── application-test.yml                 # 테스트 — mail = log impl, oauth disabled
│   │       └── db/migration/
│   │           ├── V1__create_users.sql             # 기존
│   │           ├── V2__create_projects.sql          # 기존
│   │           ├── V3__expand_users_for_auth.sql    # ★ 본 spec 신설
│   │           └── V4__create_auth_tokens.sql      # ★ 본 spec 신설
│   └── test/kotlin/com/writenote/
│       ├── auth/
│       │   ├── JwtTokenProviderTest.kt              # ★ 신설 — payload / 만료 / 변조 검증
│       │   ├── PasswordPolicyValidatorTest.kt       # ★ 신설 — 12자 + 조합 케이스
│       │   ├── AuthTokenGeneratorTest.kt            # ★ 신설 — 엔트로피 + 해시 페어
│       │   └── LoginAttemptServiceTest.kt           # ★ 신설 — 5회 잠금 / 30분 / 카운트 초기화 (TDD HARD-GATE)
│       ├── controller/
│       │   ├── AuthControllerWebTest.kt             # ★ 신설 — endpoint 12 종 happy path + 401 5 코드
│       │   └── ProjectControllerOwnerCleanupTest.kt # ★ 신설 — X-User-Id 헤더 무시 / @AuthenticationPrincipal 사용
│       ├── service/
│       │   ├── AuthServiceIT.kt                     # ★ 신설 — 회원가입 + 로그인 + refresh + 로그아웃 통합 (Testcontainers)
│       │   ├── EmailVerificationServiceIT.kt        # ★ 신설 — 토큰 발급/검증/만료/재사용 거부
│       │   ├── PasswordResetServiceIT.kt            # ★ 신설 — 30분 만료 / 일회용 / 약한 비밀번호 거부
│       │   ├── AccountLinkServiceIT.kt              # ★ 신설 — 이메일 ↔ 카카오 추가 연결 / 충돌 거부
│       │   └── KakaoOAuth2UserServiceTest.kt        # ★ 신설 — Kakao 응답 mock → user 생성/조회 + 충돌 분기
│       └── repository/
│           ├── UserRepositoryIT.kt                  # ★ 신설 — 1차 캐시 우회 패턴 (flush+clear)
│           └── AuthTokenRepositoryIT.kt             # ★ 신설 — type + tokenHash 조회 / used_at 갱신 / 청소 쿼리
└── docker-compose.yml                               # 변경 없음 (postgres 만 유지)
```

**Structure Decision**:

본 spec 은 monorepo 의 `backend/` 만 변경. 글로벌 룰 `~/.claude/rules/java/architecture.md` 의 계층형 아키텍처 (`Controller → Service → Component → Repository`) 그대로 적용한다. 본 spec 의 핵심 신규 영역:

- **`auth/` 패키지** — 인증 cross-cutting 컴포넌트 (3 필터 + JwtTokenProvider + OAuth2 success handler + KakaoOAuth2UserService + AuthenticatedPrincipal). 본 영역은 `controller/` ↔ `service/` 가 아닌 보안 인프라 영역이라 별도 패키지로 분리 (`docs/plan/00-stack §3` 박힌 디렉토리 구조 정합).
- **`components/` 신설** — 비밀번호 정책 검증 / 토큰 생성·라이프사이클 / 카카오 충돌 결정 등 Service 비대화 방지용 컴포넌트 (글로벌 룰 `architecture.md` §"Service 비대화 방지").
- **`AuthService` 와 4 개 보조 Service** — 회원가입·로그인·토큰 발급/갱신/로그아웃은 `AuthService`, 이메일 인증·비밀번호 재설정·계정 연결·잠금 카운트는 별도 Service. Service 간 호출은 허용하되 순환 참조 금지 (`~/.claude/rules/java/spring/spring-patterns.md`).
- **`Users` 엔티티 확장 + `AuthToken` 신설** — `V3`/`V4` 두 마이그레이션. `Users` 의 `password_hash`, `kakao_id` 추가 후 CHECK 제약 (둘 중 하나 필수) 박음. `AuthToken` 은 `type` ENUM 통합 테이블.
- **임시 `X-User-Id` 정리** — 001 의 `ProjectController` 가 헤더로 받던 owner 파라미터를 `@AuthenticationPrincipal AuthenticatedPrincipal` 로 교체. 헤더 처리 코드 제거 + 동등 테스트로 회귀 차단.

## Complexity Tracking

위반 / 복잡성 예외 없음. 본 spec 의 크기 (LOC ~3000~4500 추정 + 12 endpoint + 3 필터 + 2 엔티티) 는 1 spec 안에서 다루되, 구현은 1B-1 ~ 1B-6 phase 단위로 분해 (구체 phase 분해는 `/speckit-tasks` 단계 산출).

## Phase 0: Research

See [research.md](./research.md). 핵심 결정:

- **JWT 라이브러리** = `io.jsonwebtoken:jjwt` 0.12.x (HS256, Spring 5+ / Java 17+ 정합, 가장 widely used). nimbus-jose-jwt 는 V2 의 OAuth resource server 도입 시점에 재검토.
- **메일 발송 인프라** = 추상화 `MailSenderPort` + profile 별 구현 (local/test = 로그 출력, prod = `JavaMailSender` SMTP via Gmail 또는 Resend free tier 환경 변수). 본 spec 은 인터페이스 + local/test 구현 + prod 결선 placeholder 까지만. 외부 서비스 실제 결선은 본인 dogfooding 단계 별도 트랙.
- **Kakao OAuth 흐름** = `spring-boot-starter-oauth2-client` + 커스텀 `KakaoOAuth2UserService` + `OAuth2SuccessHandler` 가 JWT 발급 + URL fragment redirect (`/auth/success#access=...&refresh=...`). scope = `profile_nickname`, `account_email`. redirect_uri = `{backend}/api/auth/oauth/kakao/callback`.
- **5회 잠금 동시성** = `Users.failed_login_count` 와 `lockout_until` 인라인 + `LoginAttemptFilter` 에서 잠금 검증 + 로그인 성공/실패 시 row-level `@Lock(LockModeType.PESSIMISTIC_WRITE)` 로 카운트 갱신 (FR-038). 단일 사용자라 lock contention 거의 없지만 결정적 동작 보장.
- **갱신 토큰 형식** = 무작위 32 바이트 → base64url 인코딩 (44자 + `=` 패딩 제거) → SHA-256 해시로 DB 저장. 평문은 발급 응답에만 1회 노출.
- **갱신 토큰 회전** = V1 미적용. 같은 갱신 토큰 만료까지 재사용 가능. 로그아웃 시 즉시 row 삭제. V2 검토 (spec.md Assumptions + SoT §4-1).
- **이메일 인증 / 비밀번호 재설정 토큰** = 갱신 토큰과 동일 메커니즘 (무작위 32 바이트 + SHA-256 해시). 일회용 — 사용 시 `used_at` 갱신, 재사용 거부.
- **카카오 추가 연결 충돌** = 새 카카오 식별자가 이미 다른 user 에 묶여 있으면 `KAKAO_ALREADY_LINKED` 충돌 + 본인 계정 변경 없음 (FR-025).
- **비로그인 카카오 진입 시 이메일 충돌** = 동일 이메일 + 카카오 미연결 사용자 발견 시 `KAKAO_EMAIL_ALREADY_REGISTERED` + "로그인 후 카카오 연결" 안내 (FR-022, SoT §4-2).
- **CORS** = 와일드카드 `*` (V1, credentials=false). preflight max-age 3600. 본 spec 에서 001 의 `CorsConfig.kt` 갱신.
- **검증 명령 minimize** = phase 분해 시 라운드별 좁은 테스트 (`:backend:test --tests "*Foo*"`) + 마지막 1회 전체 (`:backend:build`). 라운드별 전체 빌드 금지 (`~/.claude/rules/shared/long-running-bash.md`).

## Phase 1: Design & Contracts

설계 산출물:

- [data-model.md](./data-model.md) — Users 확장 + AuthToken 신설 + 마이그레이션 SQL 스케치 (`V3`/`V4`) + 인덱스 + CHECK 제약 + 일일 청소 정책.
- [contracts/auth-endpoints.md](./contracts/auth-endpoints.md) — SoT §3-2 의 12 endpoint request/response/error 매트릭스. 각 endpoint 의 인증 여부 / 입력 검증 / 도메인 에러 코드 / 성공 응답 shape.
- [contracts/security-filter-chain.md](./contracts/security-filter-chain.md) — 3 분리 필터 (LoginAttempt / Jwt / ApiToken) 의 순서와 책임 + 공개/보호 endpoint 매핑 + 401 5종 코드 매핑.
- [contracts/token-formats.md](./contracts/token-formats.md) — JWT payload (sub/email/exp/iat) + access·refresh·이메일 인증·비밀번호 재설정 토큰의 만료/형식/저장 방식.
- [contracts/owner-context-migration.md](./contracts/owner-context-migration.md) — 001 의 임시 `X-User-Id` 헤더 제거 + `@AuthenticationPrincipal AuthenticatedPrincipal` 도입 + ProjectController/Service 수정 + 회귀 테스트.
- [quickstart.md](./quickstart.md) — 로컬 dogfooding 진입 절차: docker postgres → 환경 변수 (`JWT_SECRET` / 카카오 placeholder) → `bootRun` → curl 회원가입 → 메일 토큰 (로그 출력) → 인증 → 로그인 → 본인 정보 조회 → 카카오 흐름 placeholder.
- 루트 `CLAUDE.md` 의 SPECKIT 마커를 본 plan 으로 갱신.

**Post-design gate status**: 본 plan 의 모든 결정이 백엔드 SoT + 글로벌·프로젝트 룰 내. Constitution Check 위반 없음. PASS.

본 plan 의 deferred / 본 spec 밖 영역:
- 모바일 캡처용 ApiToken **발급·조회·해지 API** (SoT §3-6 #43~#46) — Week 4.
- 갱신 토큰 회전 (rotation) — V2.
- 추가 role / 권한 분리 — V2.
- 메일 발송 외부 서비스 (Resend / SendGrid / SES) 실제 결선 — 본인 dogfooding 단계 별도 트랙.
- 인증 화면 (`/auth/<panel>`) 의 endpoint 결선 — 별도 spec (본 spec 의 dogfooding GREEN 이후).
