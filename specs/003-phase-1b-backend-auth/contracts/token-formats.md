# Token Formats Contract — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [../spec.md](../spec.md) / **Plan**: [../plan.md](../plan.md)

본 문서는 본 spec 의 4 종 토큰 (JWT access / refresh / 이메일 인증 / 비밀번호 재설정) 의 형식 / 만료 / 저장 / 노출 정책을 박는다.

---

## 1. JWT Access Token

**형식**: 표준 JWT (RFC 7519) — `header.payload.signature` 의 base64url 인코딩.

**서명 알고리즘**: HS256 (HMAC-SHA256). 시크릿 = 환경 변수 `JWT_SECRET` (최소 32 바이트 / 256 비트). 시크릿은 소스에 포함 금지 (`~/.claude/rules/shared/security.md`).

**Header**:
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload (claims)**:
```json
{
    "sub": "42",
    "email": "user@example.com",
    "iat": 1719504000,
    "exp": 1719507600
}
```

→ `sub` = user id (string, JWT 표준), `iat` = 발급 시각 (epoch sec), `exp` = 만료 시각 (epoch sec, iat + 3600). 추가 claim (예: role) 은 V1 미사용 — 단일 role.

**만료**: 1 시간 (3600 초). SoT §4-1 박힘.

**저장**:
- 클라이언트 (브라우저) — localStorage. 002 의 `lib/api/client.ts` 결정.
- 서버 — 저장 X (stateless). JwtTokenProvider 가 매 요청 시 서명 검증.

**노출**:
- 로그인 / OAuth 콜백 / refresh 응답에 평문 노출.
- 로그에 출력 금지 (`~/.claude/rules/shared/security.md`).

**검증** (JwtAuthenticationFilter):
1. Authorization 헤더에서 `Bearer eyJ` 접두사 매칭
2. `JwtTokenProvider.parse(token)` — HS256 서명 검증
3. `exp` 검증 — 만료 시 `AUTH_TOKEN_EXPIRED`
4. 검증 성공 → `AuthenticatedPrincipal(userId = sub.toLong(), email = email)` SecurityContext 박음

**관련 FR**: FR-008, FR-009.

---

## 2. Refresh Token

**형식**: 무작위 32 바이트 (SecureRandom) → base64url 인코딩 (padding 제거 → 43자) → `'rt_'` 접두사 X (refresh token 은 ApiToken `wnt_` 와 달리 사용자 식별 접두사 불필요).

예: `Xb4G-zMUu0fy_iWfNZmGwz4DSiqTFOdkjOXc9bLnGwo`

**만료**: 30 일 (2,592,000 초). SoT §4-1.

**저장**:
- 클라이언트 — localStorage (access token 과 함께).
- 서버 — `auth_tokens(type='REFRESH', token_hash=SHA-256(token), expires_at=now+30d)` row.

→ DB 에는 평문 저장 X. SHA-256 해시만 저장 (FR-033, SoT §2-2).

**노출**:
- 로그인 / OAuth 콜백 응답에 평문 노출 (1회 한정 — ApiToken 과 동일 패턴).
- 이후 모든 사용은 클라이언트 → 서버 평문 전송 → 서버가 SHA-256 해시 후 DB 조회.

**검증** (`/api/auth/refresh` 호출 시):
1. 본문 `refreshToken` 추출
2. SHA-256 해시 계산
3. `auth_tokens(token_hash=...,type='REFRESH')` 조회
4. row 미존재 → `AUTH_TOKEN_INVALID` 또는 `AUTH_TOKEN_REVOKED`
5. `expires_at < now()` → `AUTH_TOKEN_EXPIRED`
6. 통과 → 새 access token 발급 (refresh token 자체는 그대로 반환 안 함, 클라이언트가 보관)

**무효화**:
- 로그아웃 시 row DELETE (즉시 무효)
- 비밀번호 재설정 확정 시 사용자의 모든 REFRESH row DELETE (보안)
- 만료 — 일일 청소 작업이 row 삭제

**회전 (Rotation)**: V1 미적용 (R-7). 같은 refresh token 만료까지 재사용.

**관련 FR**: FR-010 ~ FR-012, FR-033.

---

## 3. 이메일 인증 토큰 (EMAIL_VERIFY)

**형식**: refresh token 과 동일 — 무작위 32 바이트 → base64url 43자.

**만료**: 24 시간 (86,400 초). SoT §2-2 AuthToken.

**저장**: `auth_tokens(type='EMAIL_VERIFY', token_hash=SHA-256(token), expires_at=now+24h, used_at=null)`.

**노출**:
- 회원가입 직후 메일에 평문 노출 (메일 본문의 인증 링크).
- 메일 발송 시 평문이 메일 server log 에 남을 수 있음 — `MailSenderPort` 의 prod 구현에서 외부 SMTP 서비스 신뢰 가정 (spec.md Assumptions).

**검증** (`POST /api/auth/verify-email` 호출 시):
1. 본문 `token` 추출
2. SHA-256 해시 계산
3. `auth_tokens(token_hash=..., type='EMAIL_VERIFY')` 조회
4. row 미존재 → `AUTH_TOKEN_INVALID`
5. `expires_at < now()` → `AUTH_TOKEN_EXPIRED`
6. `used_at IS NOT NULL` → `AUTH_TOKEN_ALREADY_USED`
7. 통과 → `users.email_verified_at = now()` + `auth_tokens.used_at = now()` 단일 트랜잭션

**일회용**: 검증 성공 시 `used_at` 갱신 → 재사용 거부.

**관련 FR**: FR-005, FR-006.

---

## 4. 비밀번호 재설정 토큰 (PASSWORD_RESET)

**형식**: refresh / email verify 와 동일 — 무작위 32 바이트 → base64url 43자.

**만료**: 30 분 (1800 초). SoT §2-2 AuthToken. 가장 짧은 만료 — 비밀번호 변경의 보안 민감도.

**저장**: `auth_tokens(type='PASSWORD_RESET', token_hash=SHA-256(token), expires_at=now+30min, used_at=null)`.

**노출**:
- 비밀번호 재설정 요청 시 메일에 평문 노출 (재설정 링크).

**검증** (`POST /api/auth/password-reset/confirm` 호출 시):
1. 본문 `token` + `newPassword` 추출
2. `newPassword` → `PasswordPolicyValidator` 검증 — 위반 시 `PASSWORD_TOO_WEAK`
3. SHA-256 해시 계산
4. `auth_tokens(token_hash=..., type='PASSWORD_RESET')` 조회
5. row 미존재 → `AUTH_TOKEN_INVALID`
6. `expires_at < now()` → `AUTH_TOKEN_EXPIRED`
7. `used_at IS NOT NULL` → `AUTH_TOKEN_ALREADY_USED`
8. 통과 → 단일 트랜잭션:
    - `users.password_hash = BCrypt(newPassword)`
    - `auth_tokens.used_at = now()` (본 token)
    - `DELETE FROM auth_tokens WHERE user_id = ? AND type = 'REFRESH'` (보안 — 모든 세션 무효)

**일회용**: 동일 패턴.

**관련 FR**: FR-016 ~ FR-018.

---

## 5. 토큰 만료 비교 표

| 토큰 | 만료 | 저장 형식 | 노출 횟수 | 일회용 |
|---|---|---|---|---|
| JWT access | 1 시간 | (저장 X, stateless) | 응답 시점마다 | (해당 없음) |
| Refresh | 30 일 | `auth_tokens` SHA-256 해시 | 1회 (발급 시) | X (재사용 가능, 로그아웃 시 row 삭제) |
| Email verify | 24 시간 | `auth_tokens` SHA-256 해시 | 1회 (메일) | O (`used_at` 갱신 후 재사용 거부) |
| Password reset | 30 분 | `auth_tokens` SHA-256 해시 | 1회 (메일) | O |

---

## 6. 시크릿 관리

| 시크릿 | 환경 변수 | 사용 시점 | 비고 |
|---|---|---|---|
| JWT 서명 시크릿 | `JWT_SECRET` | JwtTokenProvider 빈 초기화 | 최소 32 바이트 / base64 / 환경 변수 의무. 본 spec 의 `application.yml` 에는 placeholder (`${JWT_SECRET:?required}`) |
| 카카오 OAuth client id | `KAKAO_CLIENT_ID` | OAuth2Config 빈 초기화 | 카카오 Developers 콘솔에서 발급 |
| 카카오 OAuth client secret | `KAKAO_CLIENT_SECRET` | 동일 | 동일 |
| SMTP host / port / username / password | `SMTP_*` | MailConfig prod profile | 본인 dogfooding 단계 결정 |

→ 모두 `.env` 파일 commit 금지 (`~/.claude/rules/shared/security.md`). 본 spec 의 `.env.sample` (또는 `application-local.yml.sample`) 에 키 이름만 박음, 값은 비움.

---

## 7. 본 contract 의 회귀 테스트 cover 목표

1. JWT 발급 — payload (sub/email/iat/exp) 정확값 (`eq()` matcher)
2. JWT 검증 — 만료된 토큰 → `AUTH_TOKEN_EXPIRED`
3. JWT 검증 — 서명 변조 토큰 → `AUTH_TOKEN_INVALID`
4. JWT 검증 — 잘못된 서명 알고리즘 (RS256) 토큰 → `AUTH_TOKEN_INVALID`
5. Refresh 토큰 — 발급 시 base64url 43자 길이 + DB 의 token_hash 가 평문과 다른 64자 hex
6. Refresh 토큰 — 사용 후 row 보존 (재사용 가능)
7. Refresh 토큰 — 로그아웃 시 row 삭제 + 다음 요청 401 `AUTH_TOKEN_REVOKED`
8. Email verify 토큰 — 24h 만료
9. Email verify 토큰 — 일회용 (사용 후 재사용 시도 → `AUTH_TOKEN_ALREADY_USED`)
10. Password reset 토큰 — 30min 만료
11. Password reset 토큰 — 일회용
12. Password reset 확정 시 사용자의 모든 REFRESH row 삭제 (보안)
