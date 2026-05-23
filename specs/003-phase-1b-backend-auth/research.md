# Phase 0 Research — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [spec.md](./spec.md) / **Plan**: [plan.md](./plan.md)

본 문서는 `/speckit-plan` Phase 0 산출물. spec.md Assumptions 와 plan.md 의 결정 영역을 (Decision / Rationale / Alternatives considered) 형식으로 박는다.

## R-1. JWT 라이브러리 선택

**Decision**: `io.jsonwebtoken:jjwt` 0.12.x (`jjwt-api` + `jjwt-impl` + `jjwt-jackson`)

**Rationale**:
- SoT(`docs/plan/03-backend-requirements.md`) §4-1 = HS256 + sub/email/exp/iat payload 명시. jjwt 가 HS256 / payload claims 표준 인터페이스 가장 명확.
- Spring Boot 4.0.6 / Java 24 / Kotlin 2.2.21 정합 검증 (jjwt 0.12.x는 Java 8+, Spring 무관, 모듈 단위 가벼움).
- Spring Boot 의 `spring-security-oauth2-resource-server` 가 같은 HS256 처리 가능하지만 V2 의 OAuth resource server 도입 시점에 재검토 영역.

**Alternatives considered**:
- `com.nimbusds:nimbus-jose-jwt` — 더 강력하지만 무겁고 RSA/EC 등 비대칭 키 관리에 적합. V1 단일 서버 HS256 에는 과함.
- `org.springframework.security:spring-security-oauth2-resource-server` — Resource Server 패턴으로 JWT 검증 가능. V2 진입 시 검토.

---

## R-2. 메일 발송 인프라

**Decision**: `MailSender` (Spring Boot `spring-boot-starter-mail` 의 `JavaMailSender`) 인터페이스 위에 본 spec 의 추상화 `MailSenderPort` 박음. profile 별 구현:
- `local`, `test` profile → `LoggingMailSender` (콘솔에 발송 내용 + 토큰 출력)
- `prod` profile → `JavaMailSender` 기반 SMTP 구현 (host/port/username/password 환경 변수)

본 spec 의 prod 구현은 인터페이스 + SMTP 연결 placeholder 까지. 외부 메일 서비스 (Gmail SMTP / Resend / SendGrid) 실제 결선은 별도 트랙(본인 dogfooding 단계).

**Rationale**:
- spec.md Assumptions 박힘 — 본 spec 범위는 추상화 + local/test 구현 + prod 결선 placeholder.
- 본인 dogfooding 단계에서 발송 채널은 결정 (Gmail SMTP 무료 + 본인 계정 사용 가능 / Resend 월 3000건 free tier 등).
- 로컬·테스트 자동 검증이 외부 메일 의존 없이 GREEN 의무 (spec.md Assumptions).

**Alternatives considered**:
- AWS SES / Resend / SendGrid 즉시 결선 — V1 비용 $0 제약 정합하나 본인 dogfooding 시점에 계정 결정 필요. 본 spec 진입 시점 미결정 → 추상화로 연기.
- 로컬에서도 SMTP 실제 발송 — 외부 의존 + CI 환경에서 불가. log impl 우선.

---

## R-3. Kakao OAuth 흐름

**Decision**: `spring-boot-starter-oauth2-client` 의 표준 OAuth2 Login flow + 커스텀 `KakaoOAuth2UserService` + `OAuth2SuccessHandler`:

1. 진입 URL `/api/auth/oauth/kakao` → Spring Security 가 자동으로 카카오 인가 endpoint 로 redirect
2. 사용자가 카카오 동의 → 카카오가 `redirect_uri = {backend}/api/auth/oauth/kakao/callback` 로 redirect
3. Spring Security 가 authorization_code 로 token 교환 → 커스텀 `KakaoOAuth2UserService` 가 사용자 정보 수신
4. `KakaoOAuth2UserService` 가 Users 조회/생성 + `KakaoConflictChecker` 통과 검증
5. `OAuth2SuccessHandler` 가 access + refresh token 발급 → 프론트로 URL fragment redirect (`/auth/success#access=...&refresh=...`)

scope = `profile_nickname`, `account_email`. 신규 가입자의 `email_verified_at` 은 즉시 채움 (FR-020).

**Rationale**:
- SoT §4-2 명시 — "Spring Security OAuth2 클라이언트 자동" + "URL fragment redirect" + "신규 = email_verified_at 즉시 채움".
- URL fragment redirect 는 토큰이 서버 로그 / 리퍼러에 남지 않는 표준 패턴.
- 커스텀 `OAuth2UserService` 가 외부 ID provider 응답을 도메인 `User` 로 매핑하는 표준 위치.

**Alternatives considered**:
- 직접 OAuth2 클라이언트 구현 (RestTemplate 으로 token 교환) — 의존성은 줄지만 redirect_uri 검증 / state 검증 / CSRF 보호 등 재구현 비용 큼.
- 카카오 콜백이 프론트로 가서 프론트가 백엔드 token endpoint 호출 — implicit-flow 비슷한 패턴이지만 client secret 노출 위험.

**STATELESS session ↔ AuthorizationRequestRepository 정합** (2026-05-23 추가):

본 spec 의 SecurityConfig 가 `SessionCreationPolicy.STATELESS` 박음 (JWT 인증 일관성). 그러나 OAuth2 Login flow 는 진입~콜백 사이 `state` 파라미터 보관용 저장소 (`AuthorizationRequestRepository`) 가 필요.

**Decision**: 기본 `HttpSessionOAuth2AuthorizationRequestRepository` (HTTP session 기반) 그대로 사용.

**근거**: Spring Security 의 `STATELESS` 정책 = SecurityContext 를 session 에 저장 X. 단, `HttpServletRequest.getSession(true)` 호출 자체는 막지 않음 — OAuth2 Login filter 의 짧은 state 보관용 session 생성 가능 (정책 위반 아님). V1 본인 1명 dogfooding 환경에서 cookie-based 커스텀 보관소 박는 비용 (~30 LOC + 테스트) 회피.

**Alternatives**: 커스텀 cookie-based `AuthorizationRequestRepository` 박음 — JWT 인증 일관성 강화. V2 외부 사용자 진입 시점에 재검토.

**T046 통합 테스트 mocking 패턴** (2026-05-23 추가):

콜백 endpoint (`GET /api/auth/oauth/kakao/callback`) 통합 테스트는 다음 mock 패턴 적용:

- `@MockitoBean OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>` — 카카오 token endpoint 호출 우회 + mock token response 반환
- `@MockitoBean KakaoOAuth2UserService` — 카카오 user info endpoint 호출 우회 + 분기별 결과 mock (NewKakaoUser / ExistingKakaoUser / `OAuth2AuthenticationException` throw)
- `OAuth2SuccessHandler` / `OAuth2FailureHandler` real — 응답 redirect 형식 검증
- `MockHttpSession` + 사전 `HttpSessionOAuth2AuthorizationRequestRepository.saveAuthorizationRequest` 호출 — Spring 의 state 매칭 정합 (실제 flow 정합)

**근거**: T046 의 본질 = "콜백 endpoint 의 응답 형식 (redirect URL fragment + 에러 코드 매핑)" 검증. `KakaoOAuth2UserService` 의 분기 로직은 T043 단위 테스트 박힘 (3 분기 케이스). T046 = T043 와 다른 영역 — controller layer 의 mocking 패턴.

**Alternatives**: `KakaoOAuth2UserService` real + 카카오 user info endpoint WireMock — 통합 깊이 강화. T043 와 중복, 비용 큼.

---

## R-4. 비밀번호 정책 / BCrypt cost

**Decision**: BCrypt cost 12 + 최소 12자 + 영문/숫자/특수문자 강제 (SoT §4-3).

검증 컴포넌트: `PasswordPolicyValidator.kt` (Component) — 입력 검증 실패 시 `PASSWORD_TOO_WEAK` 에러 코드 반환. 같은 정책이 회원가입 / 비밀번호 재설정 / 비밀번호 추가 등록 3 영역에서 재사용.

**Rationale**:
- BCrypt cost 12 = 2026 기준 클라이언트 응답 시간 200~400ms 범위. 단일 사용자 V1 환경에서 충분.
- 12자 + 조합 강제 = OWASP ASVS Level 1 의 일반 패스워드 권고.
- 동일 정책 재사용 = 분기 / 메시지 정합 보장 (FR-002 ~ FR-003 + FR-017 + FR-024).

**Alternatives considered**:
- Argon2 — 강하지만 Spring 기본 인코더 의존 + 본인 dogfooding 시점에 BCrypt 12 가 충분.
- 더 강한 정책 (16자, 패스프레이즈) — 본인이 비밀번호 매니저 사용 가정이라도 12자 + 조합이 표준 균형.

---

## R-5. 5회 실패 + 30분 잠금의 동시성

**Decision**: `Users.failed_login_count` + `Users.lockout_until` 인라인 컬럼 + `LoginAttemptFilter` (로그인 URL 한정) 에서 잠금 검증. 로그인 시도 결과 갱신은 row-level pessimistic lock 사용 (`@Lock(LockModeType.PESSIMISTIC_WRITE)`).

**Rationale**:
- SoT §4-4 + §2-3 = 사용자 테이블 인라인 + Spring Security 필터 명시.
- 동시 로그인 시도가 같은 row 를 갱신하는 경우 카운트 결정성 보장 의무 (FR-038). pessimistic lock 이 가장 단순한 결정성.
- 단일 사용자 V1 환경에서 lock contention 거의 없음 — pessimistic 의 성능 비용 무시 가능.

**Alternatives considered**:
- 별도 `login_attempts` 테이블 (시각 행 누적) — IP 기반 분기 / 분석 가능하나 V1 범위 외 + 정리 부담.
- Redis counter — V1 redis 미도입.
- Optimistic lock (`@Version`) — 충돌 시 retry 로직 필요. 본인 dogfooding 단계에서 retry 미스 시 사용자 메시지 혼란 가능.

---

## R-6. 토큰 형식 (refresh / 이메일 인증 / 비밀번호 재설정)

**Decision**: 무작위 32 바이트 (SecureRandom) → base64url 인코딩 (padding 제거 → 약 43자) → 평문은 발급 시 1회만 응답에 노출 + DB 에는 SHA-256 해시만 저장 (`AuthTokenGenerator.kt`).

만료 정책 (SoT §2-2 AuthToken):
- `EMAIL_VERIFY` — 24시간
- `PASSWORD_RESET` — 30분
- `REFRESH` — 30일

**Rationale**:
- SoT §2-2 의 SHA-256 해시 저장 정책 정합.
- 32 바이트 (256 bit) 엔트로피 = 추측 비현실적.
- 평문 1회 노출 = ApiToken 과 동일 패턴 (`docs/plan/03-backend §2-2 ApiToken` "발급 시 1회만 원본 표시").

**Alternatives considered**:
- UUID v4 — 122 bit 엔트로피로 충분하지만 base64url + 명시 길이 통일이 코드 단순성 ↑.
- JWT 로 refresh 도 발급 — SoT §4-1 = "DB 저장 + 즉시 무효" 결정. JWT refresh 는 그 결정 위배.

---

## R-7. 갱신 토큰 회전 (Rotation)

**Decision**: V1 미적용. 같은 갱신 토큰을 만료(30일)까지 재사용. 로그아웃 시에만 row 삭제.

**Rationale**:
- SoT §4-1 명시 — "rotation: V1 미적용". V2 검토.
- V1 본인 1명 환경에서 rotation 의 가치 (토큰 도난 시 자동 무효) 낮음 (도난 자체 시나리오 거의 없음).
- Rotation 도입 시 client 가 매 refresh 마다 새 토큰 저장 의무 + 동시 디바이스 race condition 추가 — V1 진입 비용 큼.

**Alternatives considered**:
- 매 refresh 마다 새 refresh token 발급 + 이전 token 무효 — 보안 강함, V2 영역.

---

## R-8. CORS V1 정책

**Decision**: 와일드카드 origin (`*`) + credentials=false + 메서드 GET/POST/PUT/PATCH/DELETE/OPTIONS + 허용 헤더 `Authorization`/`Content-Type`/`Idempotency-Key`/`Accept` + 노출 헤더 `Location` + preflight max-age 3600.

**Rationale**:
- SoT §4-6 명시. V1 본인 1명 + credentials=false 환경에서 충분.
- 토큰을 localStorage 에 보관 (헤더 전달) → Cookie 미사용 → credentials=false 안전.

**Alternatives considered**:
- 명시 origin list (`https://write-note.vercel.app`, `http://localhost:3000`) — V2 외부 사용자 진입 시점 좁힘.
- Cookie 기반 (HttpOnly + Secure + SameSite) — 본 spec 의 localStorage + Bearer 정책과 충돌.

---

## R-9. `Users` 와 `AuthToken` 의 외래키 / Cascade 정책

**Decision**:
- `auth_tokens.user_id` FK → `users(id)` `ON DELETE CASCADE` (사용자 삭제 시 모든 보조 토큰 자동 삭제).
- 본 spec 은 사용자 삭제 endpoint 자체는 제공 안 함 (Week 7 영역). 단, 향후 데이터 정리 / GDPR 등 시점에 cascade 로 토큰까지 자동 청소되어야 함.

**Rationale**:
- 토큰은 사용자 종속 데이터. 사용자 없는 토큰 = 무의미 + 보안 hazard (재사용 가능성).
- SoT §2-2 의 `auth_tokens` 명시 외래키 + 본 결정으로 cascade 박음.

**Alternatives considered**:
- `ON DELETE RESTRICT` — 사용자 삭제 막아 토큰 청소 강제. V1 사용자 삭제 흐름 없음 → CASCADE 가 단순.

---

## R-10. 일일 토큰 청소 작업

**Decision**: Spring `@Scheduled(cron = "0 0 0 * * *")` (매일 자정 UTC) 로 다음 행 삭제:
- `expires_at < now()` 인 모든 행
- `used_at IS NOT NULL` 이고 `type IN ('EMAIL_VERIFY', 'PASSWORD_RESET')` 인 행

`type=REFRESH` + `used_at` 컬럼 = 본 spec 에서는 사용 X (refresh 는 row 삭제로 무효). `used_at` 은 일회용 토큰 (`EMAIL_VERIFY`, `PASSWORD_RESET`) 만 사용.

**Rationale**:
- SoT §2-2 명시 — "매일 자정 cron 으로 만료된 행 + used_at NOT NULL 인 EMAIL_VERIFY/PASSWORD_RESET 삭제".
- Spring `@Scheduled` 가 단일 서버 V1 환경에서 가장 단순.

**Alternatives considered**:
- 별도 cron job (cron container / cron service) — Render 무료 plan 의 cron job 추가 비용 / 복잡도 증가.
- DB 트리거 — DB-side 로직 분산 + 디버그 어려움.

---

## R-11. 검증 명령 minimize

**Decision**: 본 spec 구현 phase 분해 시 라운드별 좁은 테스트 (`./gradlew :backend:test --tests "*Foo*"`) + ktlint 만 실행. 전체 빌드 (`./gradlew build`) 는 모든 phase 완료 후 1 회만.

**Rationale**:
- `~/.claude/rules/shared/long-running-bash.md` §"검증 명령 범위/횟수 minimize" 의 HARD-GATE 적용.
- 회귀 사례 — 라운드별 전체 빌드 강제 시 gradle test 6~8 회 누적 + 토큰 30K~50K 낭비.

**Alternatives considered**:
- 라운드별 `:backend:test` 전체 — 작업 무관 테스트 누적 실행. minimize 룰 위반.

---

## R-12. Subagent 위임 vs 직접 수행

**Decision**: 본 spec 의 phase 분해 시 다음 기준으로 위임 결정:

| phase 후보 | 직접 vs 위임 |
|---|---|
| `User` 엔티티 확장 + V3 마이그레이션 | 직접 (단일 entity + SQL, ~150 LOC) |
| `AuthToken` 엔티티 + V4 마이그레이션 + Repository | 직접 (단일 entity + SQL + repo, ~200 LOC) |
| `PasswordPolicyValidator` + `AuthTokenGenerator` + JwtTokenProvider | 직접 (Component 단위, 각 ~100 LOC) |
| `AuthService` + 5 endpoint (signup/verify/login/refresh/logout) | 위임 검토 (다중 endpoint + TDD HARD-GATE + 라운드 의존) |
| `KakaoOAuth2UserService` + `OAuth2SuccessHandler` + 충돌 분기 | 위임 검토 (다중 분기 + 외부 의존 + TDD) |
| `PasswordResetService` + `EmailVerificationService` | 직접 (단일 흐름 + TDD) |
| `LoginAttemptService` + Filter | 위임 검토 (잠금 동시성 + 4 회귀 케이스 TDD) |
| `AccountLinkService` (이메일 ↔ 카카오) | 위임 검토 (다중 분기 + 충돌) |
| `ProjectController` owner context 교체 | 직접 (시그니처 수정 + 회귀 테스트, ~80 LOC) |

**Rationale**:
- `~/.claude/rules/shared/subagent-delegation-cost.md` 의 게이트 3 질문 (LOC>200 / 추측 위험 / 병렬 이득) 적용.
- 위임 1회 ≈ 25,000+ 토큰. 단일 파일 ~50줄 / 명확한 시그니처 변경은 직접.

**Alternatives considered**:
- 모든 phase 위임 — 룰 위반 + 토큰 비용 폭증.
- 모든 phase 직접 — 다중 분기 + 라운드 의존 phase 에서 컨텍스트 폭발.

---

## R-13. 메일 발송과 트랜잭션 경계

**Decision**:
- 메일 발송은 `@TransactionalEventListener(phase = AFTER_COMMIT)` 패턴으로 트랜잭션 외부에서 수행.
- 메일 발송 트리거 이벤트 (`EmailVerificationRequestedEvent` / `PasswordResetRequestedEvent`) 는 `AuthService` / `EmailVerificationService` / `PasswordResetService` 가 발행.
- 발행 메서드는 `@Transactional(rollbackFor = Exception::class)` 의무 (`~/.claude/rules/java/spring/spring-patterns.md` §"@Transactional + @TransactionalEventListener 계약").

**Rationale**:
- 메일 발송 실패가 회원가입 / 재설정 요청 자체를 롤백시키면 안 됨 (메일 server 장애 시 사용자 가입 자체 실패) — AFTER_COMMIT 으로 일관성 보장.
- 글로벌 룰 §"@Transactional + @TransactionalEventListener 계약" 박힘 — 회귀 사례 박힘 (트랜잭션 없으면 즉시 발행으로 AFTER_COMMIT 보장 깨짐).

**Alternatives considered**:
- 트랜잭션 내부 직접 발송 — 메일 실패 시 트랜잭션 롤백 → 사용자 데이터 불일치 회피.
- 별도 메시지 큐 (RabbitMQ / SQS) — V1 인프라 비용 / 복잡도 추가.

---

## R-14. JPA 1차 캐시 우회 의무

**Decision**: 본 spec 의 모든 Repository 통합 테스트 (`UserRepositoryIT`, `AuthTokenRepositoryIT`) 는 `EntityManager.flush() + clear()` 후 `findById` 패턴 강제 (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md`).

특히 검증 대상:
- `Users` 의 DB-side default (`created_at`, `updated_at`)
- `AuthToken` 의 UNIQUE 제약 (`token_hash` UNIQUE)
- `Users` 의 CHECK 제약 (`password_hash` OR `kakao_id` 최소 하나)

**Rationale**:
- 글로벌 룰 jpa-test-patterns.md §1 HARD-GATE. 회귀 사례 (PoC 0-2) 박힘.

**Alternatives considered**:
- `save` + `findById` 만 — 1차 캐시 hit 으로 DB 미반영 검증 실패.

---

## R-16. Filter 가 request body 1회 cache + controller 재읽기 (Phase 6 R2 의외 결정)

**Decision**: 커스텀 `CachedBodyHttpServletRequest` 박음 (`backend/src/main/kotlin/com/writenote/auth/CachedBodyHttpServletRequest.kt`). HttpServletRequestWrapper 상속 + 생성자에서 `request.inputStream.readAllBytes()` cache + `getInputStream()` override → 매 호출마다 새 `ByteArrayInputStream` 반환.

**Rationale**:
- LoginAttemptFilter 가 POST /api/auth/login 의 body email 추출 의무 + controller 의 `@RequestBody LoginRequest` 매핑 의무 → body 2회 read 필요.
- Spring 의 `ContentCachingRequestWrapper` 가 docs 상 "multiple reads" 명시되어 있지만 실제 구현은 `getContentAsByteArray()` 만 cache (logging 용). `getInputStream()` 자체는 1회 read 후 consumed → controller 가 빈 stream 받음 → `@RequestBody` 매핑 fail.
- 5 fail 회귀로 확인 (AuthControllerWebTest login 5 케이스). 커스텀 wrapper 박은 후 GREEN.

**Alternatives considered**:
- `ContentCachingRequestWrapper` — 표준 보이지만 본 사용처 부적합 (docs 와 실제 동작 불일치).
- HandlerInterceptor 패턴 — Filter 미사용. 본 spec contracts/security-filter-chain.md §1 의 LoginAttemptFilter 위치와 충돌.

---

## R-15. 운영 신호 정합

**Decision**: 본 spec 의 인증 도입 시 `/actuator/health` 의 보안 노출 정책 그대로 (001 박힌 baseline). DB / mail / OAuth client 의 health check 가 DOWN 되면 거슬려서 끄지 말 것 (`~/.claude/rules/shared/observability-signals.md` HARD-GATE).

**Rationale**:
- 본 spec 의 모든 인증 흐름이 DB + mail 의존. DOWN 신호 자체가 운영 영향 신호.

**Alternatives considered**:
- health check 제외 — observability-signals 위반.
