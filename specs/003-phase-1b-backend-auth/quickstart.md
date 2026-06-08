# Quickstart — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [spec.md](./spec.md) / **Plan**: [plan.md](./plan.md)

본 문서는 본 spec implementation 진입 후 로컬 dogfooding 검증 절차. 사용자가 본 spec 완료 시점에 `curl` 또는 `httpie` 로 12 endpoint 동작을 직접 확인 가능하도록 박는다.

---

## 0. 사전 점검 (본 spec implementation 진입 직전)

```bash
# 현재 워크트리 확인
git status --short
git branch --show-current   # 003-phase-1b-backend-auth

# 로컬 docker postgres 컨테이너 확인
docker compose ps

# 기존 마이그레이션 확인 (V1, V2 만 있어야 함)
ls /Users/jongwan-air/Desktop/workspaces/write-note/backend/src/main/resources/db/migration/
# 출력: V1__create_users.sql / V2__create_projects.sql
```

본 spec 의 V3 / V4 마이그레이션 적용은 **사용자 명시 컨펌 후** (`.claude/rules/infra/external-infra-safety.md` §1 HARD-GATE).

---

## 1. 의존성 추가 + 빌드 확인

`backend/build.gradle.kts` 에 추가 (구체 버전은 implementation 단계 결정):

```kotlin
dependencies {
    // 기존
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // ★ 본 spec 추가
    implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("io.jsonwebtoken:jjwt-api:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")
}
```

빌드 확인:
```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note/backend
./gradlew dependencies --configuration runtimeClasspath | grep -E "(oauth2-client|spring-boot-starter-mail|jjwt)"
./gradlew compileKotlin
```

---

## 2. 환경 변수 설정 (로컬)

`backend/.env.local.sample` (gitignore 대상이 아니라 sample 만 commit) 신설:

```
JWT_SECRET=local-dev-secret-replace-me-with-32bytes-base64-string
KAKAO_CLIENT_ID=local-placeholder-not-used-without-actual-kakao-app
KAKAO_CLIENT_SECRET=local-placeholder
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USERNAME=
SMTP_PASSWORD=
```

본인 dogfooding 시 본인이 만든 카카오 앱의 client_id/secret 환경 변수로 export (commit 금지).

---

## 3. 로컬 docker postgres 기동

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note
docker compose up -d --wait postgres
# 첫 기동 시 V1 / V2 마이그레이션 자동 적용 (001 의 BootRun 흐름)
```

---

## 4. V3 / V4 마이그레이션 적용 (사용자 컨펌 필요)

본 spec 의 신규 마이그레이션 적용은 외부 DB 쓰기 — `.claude/rules/infra/external-infra-safety.md` §1 의 사용자 명시 컨펌 필수.

```bash
# 작성된 V3, V4 SQL 리뷰
cat backend/src/main/resources/db/migration/V3__expand_users_for_auth.sql
cat backend/src/main/resources/db/migration/V4__create_auth_tokens.sql

# 사용자 컨펌 후 적용 — 두 가지 옵션
# 옵션 A: bootRun 시 Flyway 자동 적용
./gradlew :backend:bootRun --args='--spring.profiles.active=local'
# 옵션 B: gradle 명령으로 명시 적용 (Flyway plugin 도입 시)
# ./gradlew :backend:flywayMigrate
```

적용 검증:
```sql
-- psql 또는 IDE 의 DB 클라이언트
\d users        -- 신규 컬럼 7개 확인
\d auth_tokens  -- 신규 테이블 + 인덱스 3개 확인
```

---

## 5. 빌드 + 자동 검증 게이트

```bash
cd /Users/jongwan-air/Desktop/workspaces/write-note/backend
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

GREEN 시 본 spec 의 자동화 검증 완료 (SC-009).

---

## 6. 본인 dogfooding 진입 — 12 endpoint 흐름

### 6-1. 이메일 가입 + 인증 + 로그인 (US1)

```bash
# 회원가입
curl -X POST http://localhost:8080/api/auth/signup/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyStrong!Pass123"}'
# → 201 + success:true, data:{userId,email,emailVerifySent:true}

# 로컬 메일 발송 — LoggingMailSender 가 콘솔에 토큰 출력
# bootRun 로그 확인:
# "[MAIL] Email verify link: http://localhost:8080/api/auth/verify-email?token=Ab3xZ..."

# 이메일 인증 (토큰을 본문에 전달)
curl -X POST http://localhost:8080/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"Ab3xZ..."}'
# → 200 + success:true, data:null

# 로그인
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyStrong!Pass123"}'
# → 200 + accessToken + refreshToken + 만료
ACCESS=...
REFRESH=...

# 본인 정보 조회
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer $ACCESS"
# → 200 + {userId, email, kakaoLinked:false, emailVerifiedAt, activeApiTokenCount:0}

# refresh
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"
# → 200 + 새 accessToken

# 로그아웃
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"
# → 200 + success:true, data:null

# 로그아웃 후 같은 refresh token → AUTH_TOKEN_REVOKED
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"
# → 401 + error.code = "AUTH_TOKEN_REVOKED"
```

### 6-2. 5회 잠금 (US4)

```bash
# 잘못된 비밀번호 5회 시도
for i in 1 2 3 4 5; do
    curl -X POST http://localhost:8080/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com","password":"wrong"}'
    echo
done
# 1~5: 401 + LOGIN_FAILED

# 6번째 → LOGIN_LOCKED
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyStrong!Pass123"}'
# → 401 + LOGIN_LOCKED (30 분 후 재시도 안내)
```

### 6-3. 비밀번호 재설정 (US3)

```bash
# 재설정 요청
curl -X POST http://localhost:8080/api/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# → 200 + success:true

# bootRun 로그 확인 — 재설정 토큰
# "[MAIL] Password reset link: http://localhost:8080/api/auth/password-reset/confirm?token=Yc5..."

# 재설정 확정
curl -X POST http://localhost:8080/api/auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token":"Yc5...","newPassword":"NewStrong!Pass456"}'
# → 200 + success:true

# 새 비밀번호로 로그인 GREEN
```

### 6-4. 카카오 OAuth (US2) — 외부 의존

본 흐름은 카카오 Developers 콘솔에 실제 앱 등록 + `redirect_uri = http://localhost:8080/api/auth/oauth/kakao/callback` 등록 후 가능.

```bash
# 본인이 브라우저에서 진입
open http://localhost:8080/api/auth/oauth/kakao
# → 카카오 인가 화면 → 동의 → 콜백 → /auth/success#access=...&refresh=...
```

본 spec 의 자동 회귀 테스트는 외부 카카오 호출 mock (`@MockBean OAuth2UserService`) 으로 진행. 실제 카카오 콘솔 등록 없이 unit 테스트 GREEN.

### 6-5. 임시 owner 헤더 무시 (US6)

```bash
# 기존 001 endpoint 에 X-User-Id 헤더 변조 시도 + JWT 동반
curl http://localhost:8080/api/projects \
  -H "Authorization: Bearer $ACCESS" \
  -H "X-User-Id: 99"
# → 응답에 X-User-Id 99 는 무시되고 ACCESS 토큰의 user 만 사용됨
```

```bash
# 본 spec 완료 시점에 임시 X-User-Id 사용처 0 건 검증 (SC-008)
grep -rn "X-User-Id" /Users/jongwan-air/Desktop/workspaces/write-note/backend/src/main/
# → 0 line 의무
```

---

## 7. 002 frontend 와의 통합 확인 (선택)

본 spec 은 backend 한정이지만 002 frontend 의 인증 화면 (`/auth/login` 등) 이 본 spec endpoint 와 결선되어 있지 않다 (`docs/plan/02-progress.md §1 002`). 본 spec 완료 후 다음과 같이 dogfooding 가능:

```bash
# frontend 실행
cd /Users/jongwan-air/Desktop/workspaces/write-note/frontend
pnpm dev
# → http://localhost:3000

# 인증 화면 진입 — 정적 외관만 표시 (백엔드 결선 없음)
# 본 spec 의 endpoint 와 결선은 별도 spec (인증 화면 결선 spec)
```

---

## 8. 본 spec 의 phase 분해 가이드

`/speckit-tasks` 단계에서 다음 단위로 분해 추정:

1. **R-1**: 의존성 추가 + JwtConfig + MailConfig + OAuth2Config 빈 골격 (직접, ~150 LOC)
2. **R-2**: `User` 확장 + `V3` 마이그레이션 + Repository 갱신 (직접, ~200 LOC + Repository IT)
3. **R-3**: `AuthToken` + `V4` 마이그레이션 + Repository + Cleanup 작업 (직접, ~250 LOC + Repository IT)
4. **R-4**: `PasswordPolicyValidator` + `AuthTokenGenerator` + `JwtTokenProvider` Component (직접, ~300 LOC + 단위 테스트, TDD HARD-GATE)
5. **R-5**: `AuthService` 5 endpoint (signup/verify-email/login/refresh/logout) + 3 분리 필터 + AuthErrorEntryPoint (위임 검토, ~800 LOC + Web 테스트, TDD HARD-GATE)
6. **R-6**: `PasswordResetService` + `EmailVerificationService` (직접 또는 위임, ~400 LOC + Service IT)
7. **R-7**: `LoginAttemptService` + `LoginAttemptFilter` + 동시성 lock (위임 검토 — 4 회귀 케이스 TDD HARD-GATE)
8. **R-8**: `KakaoOAuth2UserService` + `OAuth2SuccessHandler` + 충돌 분기 (위임 검토 — 외부 mock + 다중 분기 TDD)
9. **R-9**: `AccountLinkService` (link/kakao + link/email) (위임 검토 — 다중 분기)
10. **R-10**: `ProjectController` owner context 교체 + 회귀 테스트 + grep SC-008 검증 (직접, ~150 LOC)
11. **R-11**: TokenCleanupService + @Scheduled 등록 + 회귀 테스트 (직접, ~80 LOC)
12. **R-12**: 전체 자동 검증 게이트 (ktlint + checkstyle + test + build) + 회귀 GREEN + `docs/plan/02-progress.md` §1/§3 갱신

라운드별 검증 명령은 좁은 테스트 + ktlint 만. 전체 빌드는 R-12 에서만 1회.

---

## 9. 자주 묻는 점검 명령

```bash
# Spring profile 확인
./gradlew :backend:bootRun --args='--spring.profiles.active=local'

# 단일 테스트 클래스만
./gradlew :backend:test --tests "*PasswordPolicyValidatorTest"

# 통합 테스트만 (Testcontainers)
./gradlew :backend:test --tests "*IT"

# H2 가 아닌 실제 postgres docker 사용 확인 (jpa-test-patterns.md HARD-GATE)
# → @AutoConfigureTestDatabase(replace = NONE) 적용 의무

# X-User-Id 사용처 검증
grep -rn "X-User-Id" backend/src/main/
```

---

## 10. 완료 후 갱신 의무

본 spec 완료 시점에 다음 문서 갱신:

| 문서 | 갱신 내용 |
|---|---|
| `docs/plan/02-progress.md` §1 | "Phase 1B Backend Auth Foundation = ✅" entry 추가 + commit hash |
| `docs/plan/02-progress.md` §3 | 다음 진입점 = Week 2 (Project/Character CRUD 확장) 또는 002 dogfooding 마무리 |
| `docs/plan/03-backend-requirements.md` §6 | 변경 발생 시 (예: 추가 결정 박힘) 행 추가 |
| `specs/003-phase-1b-backend-auth/` | spec/plan/research/data-model/contracts 갱신 (변경 시) |
| `docs/retrospectives/2026-MM-DD-phase-1b-backend-auth.md` | 5축 회고 (`.claude/skills/retrospective/SKILL.md`) |
