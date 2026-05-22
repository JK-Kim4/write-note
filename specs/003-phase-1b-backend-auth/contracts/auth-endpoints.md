# Auth Endpoints Contract — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [../spec.md](../spec.md) / **Plan**: [../plan.md](../plan.md)

본 문서는 백엔드 SoT (`docs/plan/03-backend-requirements.md`) §3-2 의 12 인증·사용자 endpoint 의 request/response/error 매트릭스. 모든 응답은 001 의 `Result<T>` envelope 통일 (`success`/`data` 또는 `success`/`error.code`/`error.message`).

---

## 공통 응답 envelope

성공:
```json
{ "success": true, "data": { /* 엔드포인트별 */ } }
```

실패:
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "사용자 메시지" } }
```

성공이지만 반환 데이터 없는 경우 (`POST /api/auth/verify-email` 등):
```json
{ "success": true, "data": null }
```

---

## 1. `POST /api/auth/signup/email` — 이메일·비밀번호 회원가입

**인증**: X (공개)

**Request**:
```json
{
    "email": "user@example.com",
    "password": "MyStrong!Pass123"
}
```

**검증**:
- `email` — RFC 5321 형식 (Hibernate Validator `@Email`)
- `password` — 최소 12자 + 영문/숫자/특수 조합 (`PasswordPolicyValidator`)

**성공 응답** (`201 Created`):
```json
{
    "success": true,
    "data": {
        "userId": 42,
        "email": "user@example.com",
        "emailVerifySent": true
    }
}
```

→ 회원가입 직후 이메일 인증 토큰 24시간 발급 + 메일 발송 (AFTER_COMMIT 이벤트).

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `EMAIL_INVALID_FORMAT` | 이메일 형식 오류 |
| 400 | `PASSWORD_TOO_WEAK` | 비밀번호 정책 위반 |
| 400 | `VALIDATION_FAILED` | 그 외 입력 검증 |
| 409 | `EMAIL_ALREADY_REGISTERED` | 같은 이메일 기존 가입 |

**관련 FR**: FR-001 ~ FR-005.

---

## 2. `POST /api/auth/verify-email` — 이메일 인증 토큰 검증

**인증**: X (공개)

**Request**:
```json
{ "token": "Ab3xZ..." }
```

→ `token` = 메일 링크의 query string 에서 받은 평문 토큰. 서버가 SHA-256 해시로 변환하여 `auth_tokens` 조회.

**성공 응답** (`200 OK`):
```json
{ "success": true, "data": null }
```

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `AUTH_TOKEN_INVALID` | 토큰 미존재 / 형식 오류 |
| 400 | `AUTH_TOKEN_EXPIRED` | `expires_at < now()` |
| 409 | `AUTH_TOKEN_ALREADY_USED` | `used_at IS NOT NULL` (재사용 시도) |

**부수 효과**: 검증 성공 시 `users.email_verified_at = now()` + `auth_tokens.used_at = now()` 단일 트랜잭션 갱신.

**관련 FR**: FR-005 ~ FR-006.

---

## 3. `POST /api/auth/login` — 이메일·비밀번호 로그인

**인증**: X (공개) — 단 `LoginAttemptFilter` 가 잠금 검증.

**Request**:
```json
{
    "email": "user@example.com",
    "password": "MyStrong!Pass123"
}
```

**성공 응답** (`200 OK`):
```json
{
    "success": true,
    "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "Xb4...",
        "accessTokenExpiresIn": 3600,
        "refreshTokenExpiresIn": 2592000
    }
}
```

→ access token = JWT (HS256). refresh token = 평문 (1회 노출).

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 입력 누락 |
| 401 | `EMAIL_NOT_VERIFIED` | 이메일 인증 미완료 (FR-007) |
| 401 | `LOGIN_FAILED` | 비밀번호 불일치 (실패 카운트 +1) |
| 401 | `LOGIN_LOCKED` | `lockout_until > now()` (FR-013, FR-015) — `LoginAttemptFilter` 가 controller 진입 전 차단 |

**부수 효과** (`@Lock(LockModeType.PESSIMISTIC_WRITE)` 로 `users` row 갱신):
- 성공 → `last_login_at = now()` + `failed_login_count = 0` + 갱신 토큰 1행 INSERT
- 실패 → `failed_login_count += 1`. 5회 도달 시 `lockout_until = now() + 30분`

**관련 FR**: FR-007 ~ FR-009, FR-013 ~ FR-015, FR-038.

---

## 4. `GET /api/auth/oauth/kakao` — 카카오 로그인 진입

**인증**: X (공개)

**Request**: 없음 (GET)

**응답**: `302 Found` Location: 카카오 인가 endpoint URL (Spring Security 자동).

**관련 FR**: FR-019.

→ 본 endpoint 는 Spring Security `OAuth2 Login` filter 가 자동 처리. 컨트롤러 코드 없음.

---

## 5. `GET /api/auth/oauth/kakao/callback` — 카카오 콜백

**인증**: X (공개)

**Request**: `?code=...&state=...` (카카오 표준 콜백)

**응답** (성공): `302 Found` Location: `{frontend}/auth/success#access=...&refresh=...&accessExpiresIn=3600&refreshExpiresIn=2592000`

**응답** (실패):
- `KAKAO_EMAIL_ALREADY_REGISTERED` — `302 Found` Location: `{frontend}/auth/login-error?code=KAKAO_EMAIL_ALREADY_REGISTERED` (사용자가 이메일 가입자로 이미 존재 + 카카오 미연결 + 비로그인 상태, FR-022)
- 그 외 OAuth 표준 실패 — `302 Found` Location: `{frontend}/auth/login-error?code=OAUTH_FAILED`

**부수 효과** (트랜잭션 — 카카오 외부 API 호출은 트랜잭션 밖):
- 신규 카카오 사용자: `users` INSERT (`kakao_id`, `email`, `email_verified_at = now()`)
- 기존 카카오 연결 사용자: 조회만 + `last_login_at` 갱신
- 충돌 (이메일 가입자 + 카카오 미연결 + 비로그인): 응답으로 충돌 코드

**관련 FR**: FR-019 ~ FR-022.

---

## 6. `POST /api/auth/password-reset/request` — 재설정 요청

**인증**: X (공개)

**Request**:
```json
{ "email": "user@example.com" }
```

**성공 응답** (`200 OK`):
```json
{ "success": true, "data": null }
```

→ 가입 미존재 이메일에도 200 응답 (계정 존재 여부 노출 회피 — `~/.claude/rules/shared/security.md` 의 정보 비노출 원칙). 가입 미존재 시 메일 발송 안 함.

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `EMAIL_INVALID_FORMAT` | 이메일 형식 오류 |
| 400 | `VALIDATION_FAILED` | 입력 누락 |

**부수 효과**: 가입 이메일이면 30분 만료 `PASSWORD_RESET` 토큰 발급 + 메일 발송 (AFTER_COMMIT 이벤트).

**관련 FR**: FR-016.

---

## 7. `POST /api/auth/password-reset/confirm` — 재설정 확정

**인증**: X (공개)

**Request**:
```json
{
    "token": "Yc5...",
    "newPassword": "NewStrong!Pass456"
}
```

**성공 응답** (`200 OK`):
```json
{ "success": true, "data": null }
```

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `AUTH_TOKEN_INVALID` | 토큰 미존재 |
| 400 | `AUTH_TOKEN_EXPIRED` | 만료 |
| 409 | `AUTH_TOKEN_ALREADY_USED` | 재사용 |
| 400 | `PASSWORD_TOO_WEAK` | 새 비밀번호 정책 위반 |

**부수 효과**: `users.password_hash` 갱신 + `auth_tokens.used_at = now()` + 사용자의 모든 `REFRESH` 토큰 row 삭제 (보안 — 비밀번호 변경 시 모든 세션 무효).

**관련 FR**: FR-016 ~ FR-018.

---

## 8. `POST /api/auth/refresh` — access token 갱신

**인증**: X (refresh token 헤더 또는 본문)

**Request** (본문 방식 채택):
```json
{ "refreshToken": "Xb4..." }
```

**성공 응답** (`200 OK`):
```json
{
    "success": true,
    "data": {
        "accessToken": "eyJ...",
        "accessTokenExpiresIn": 3600
    }
}
```

→ V1 = 회전 미적용 (R-7). 기존 refresh token 그대로, 새 access token 만 발급.

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 401 | `AUTH_TOKEN_INVALID` | refresh token 미존재 / 형식 오류 |
| 401 | `AUTH_TOKEN_EXPIRED` | 만료 |
| 401 | `AUTH_TOKEN_REVOKED` | 로그아웃으로 row 삭제됨 |

**관련 FR**: FR-010 ~ FR-012.

---

## 9. `POST /api/auth/logout` — 로그아웃

**인증**: O (access token)

**Request**:
```json
{ "refreshToken": "Xb4..." }
```

**성공 응답** (`200 OK`):
```json
{ "success": true, "data": null }
```

→ 본인이 보유한 refresh token 만 삭제 가능. 다른 사용자의 refresh token 은 SQL 단계에서 `WHERE user_id = :authenticatedUserId` 강제.

**실패 응답**: 토큰 미존재 시 200 (멱등성 — 이미 로그아웃 상태에서 한 번 더 호출해도 성공).

**관련 FR**: FR-012.

---

## 10. `GET /api/auth/me` — 본인 정보 조회

**인증**: O (access token)

**성공 응답** (`200 OK`):
```json
{
    "success": true,
    "data": {
        "userId": 42,
        "email": "user@example.com",
        "kakaoLinked": true,
        "emailVerifiedAt": "2026-05-23T14:30:00Z",
        "activeApiTokenCount": 0
    }
}
```

→ `activeApiTokenCount` 는 Week 4 의 ApiToken 테이블 의존이므로 본 spec 진입 시점에는 항상 `0` 반환 (테이블 자체 미존재 → COUNT(*) WHERE revoked_at IS NULL = 0).

**Week 4 영향**: ApiToken 테이블 신설 후 본 endpoint 의 `activeApiTokenCount` 가 실제 active 토큰 수 반환하도록 조정. 본 spec 진입 시점에는 0 반환 + Week 4 진입 시 자연 교체.

**실패 응답**: 401 (보호 endpoint 표준).

**관련 FR**: FR-026.

---

## 11. `POST /api/auth/link/kakao` — 카카오 추가 연결 시작

**인증**: O (access token)

**Request**: 없음 (POST 본문 없음)

**응답**: `302 Found` Location: 카카오 인가 endpoint URL — 단 `state` 파라미터에 본인 user id 인코딩 (서버에서 콜백 시 추가 연결 분기 결정).

본 endpoint 는 `OAuth2 Login filter` 외부에서 별도 처리. 콜백 처리 시 기존 카카오 콜백과 분기:
- `state` 가 추가 연결 시그널 포함 → 인증된 사용자의 user id 에 `kakao_id` 추가
- 그 외 → 표준 OAuth Login 흐름 (endpoint #5)

**부수 효과** (콜백 시점, 트랜잭션 — 카카오 API 호출은 트랜잭션 밖):
- 본인 user 의 `kakao_id` UPDATE
- 충돌 (`kakao_id` 가 다른 사용자에 묶임) → `KAKAO_ALREADY_LINKED` 응답 + 본인 계정 변경 없음

**실패 응답**:
- `409 KAKAO_ALREADY_LINKED` — 동일 카카오 식별자 다른 사용자에 묶임 (FR-025)
- `409 KAKAO_LINK_CONFLICT` — 본인 user 가 이미 다른 카카오 식별자에 연결

**관련 FR**: FR-023, FR-025.

---

## 12. `POST /api/auth/link/email` — 이메일·비밀번호 추가 등록

**인증**: O (access token, 카카오 가입자)

**Request**:
```json
{ "password": "MyStrong!Pass789" }
```

→ 이메일은 카카오에서 받은 본인 이메일 그대로 사용 (Request 에서 받지 않음). 비밀번호만 입력.

**성공 응답** (`200 OK`):
```json
{
    "success": true,
    "data": {
        "userId": 42,
        "email": "user@example.com",
        "passwordSet": true
    }
}
```

**실패 응답**:

| HTTP | code | 조건 |
|---|---|---|
| 400 | `PASSWORD_TOO_WEAK` | 비밀번호 정책 위반 |
| 409 | `PASSWORD_ALREADY_SET` | 이미 비밀번호 설정됨 |

**부수 효과**: `users.password_hash` UPDATE.

**관련 FR**: FR-024.

---

## 13. 추가 모든 보호 endpoint (예: 001 의 `/api/projects/*`) 갱신

본 spec 의 owner context 교체 (FR-027, FR-028) 영향으로 기존 보호 endpoint 들이 `X-User-Id` 헤더 처리 코드 제거 + `@AuthenticationPrincipal AuthenticatedPrincipal` 사용으로 교체. 상세 흐름은 [`owner-context-migration.md`](./owner-context-migration.md) 참조.

---

## 14. 에러 코드 매트릭스 요약

본 spec 신규 에러 코드 + 기존 001 코드 사용처:

| code | HTTP | 사용처 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 모든 endpoint 의 입력 검증 일반 |
| `EMAIL_INVALID_FORMAT` | 400 | signup-email, password-reset |
| `PASSWORD_TOO_WEAK` | 400 | signup-email, password-reset-confirm, link-email |
| `EMAIL_NOT_VERIFIED` | 401 | login |
| `EMAIL_ALREADY_REGISTERED` | 409 | signup-email |
| `KAKAO_EMAIL_ALREADY_REGISTERED` | 409 | oauth callback (비로그인) |
| `KAKAO_ALREADY_LINKED` | 409 | link-kakao |
| `KAKAO_LINK_CONFLICT` | 409 | link-kakao |
| `PASSWORD_ALREADY_SET` | 409 | link-email |
| `AUTH_TOKEN_MISSING` | 401 | 보호 endpoint 일반 (필터) |
| `AUTH_TOKEN_INVALID` | 401 | 보호 endpoint / refresh / verify-email / password-reset |
| `AUTH_TOKEN_EXPIRED` | 401 | 보호 endpoint / refresh / verify-email / password-reset |
| `AUTH_TOKEN_REVOKED` | 401 | refresh (row 삭제됨) |
| `AUTH_TOKEN_ALREADY_USED` | 409 | verify-email / password-reset-confirm (재사용) |
| `LOGIN_FAILED` | 401 | login (비밀번호 불일치, 카운트 +1) |
| `LOGIN_LOCKED` | 401 | login (잠금, LoginAttemptFilter) |
| `RESOURCE_NOT_FOUND` | 404 | (기존 001) — 본 spec 의 보호 endpoint 가 cross-user 접근 시 노출 회피 |
| `INTERNAL_SERVER_ERROR` | 500 | (기존 001) — 예상치 못한 예외 |

**관련 FR**: FR-030, FR-036, FR-037.

→ 본 spec 의 자동 회귀 테스트가 위 매트릭스의 모든 코드 100% 경로를 커버해야 함 (SC-004).
