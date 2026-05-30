# Contract: Auth Cookie 전환

**Date**: 2026-05-28 | **Plan**: [../plan.md](../plan.md) | **Research**: R-2~R-5, R-8

003 의 헤더 기반 JWT 인증을 **httpOnly 쿠키**로 전환하는 backend 변경 계약. 헤더 인증은 **병존 유지**(003 회귀 보존 + Week 4 ApiToken 헤더). 영향 파일: `JwtAuthenticationFilter` / `AuthController` / `OAuth2SuccessHandler` / `SecurityConfig`(검토) + `AuthCookieFactory`(신설 후보).

---

## 1. Set-Cookie 발급 형식 (R-2)

```
Set-Cookie: access_token=<JWT>; Max-Age=3600; Path=/; HttpOnly; SameSite=Lax[; Secure]
Set-Cookie: refresh_token=<plaintext>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax[; Secure]
```

- `Secure` = 환경별(`app.cookie.secure` env — 로컬 false / 배포 true)
- `Domain` 미지정(host-only — same-origin 프록시 host 귀속)
- Spring `ResponseCookie.from(name, value).httpOnly(true).sameSite("Lax").path("/").maxAge(sec).secure(env).build()`

---

## 2. 토큰 read 우선순위 (R-3) — JwtAuthenticationFilter

```text
1. Authorization: Bearer eyJ 헤더 존재 → 헤더 토큰 검증 (003 동작 유지)
2. 헤더 부재 → access_token 쿠키 존재 → 쿠키 토큰 검증 (신규)
3. 둘 다 부재 → pass-through (인증 안 됨 → 보호 endpoint 는 EntryPoint 401)
```

- 검증 실패(만료/무효) 시 현 동작(직접 401 `Result.failure`) 유지.
- 003 의 `JwtAuthenticationFilterTest` 헤더 케이스 GREEN 유지 + 쿠키 케이스 신규 추가.

---

## 3. endpoint 별 쿠키 동작 (R-4)

| endpoint | 쿠키 동작 | body |
|---|---|---|
| `POST /api/auth/login` | `Set-Cookie` access + refresh | `TokenPairResponse` 유지(frontend 무시) |
| `POST /api/auth/refresh` | `Set-Cookie` access + refresh(회전) | `TokenPairResponse` 유지. refresh 토큰은 쿠키에서도 read 가능(body 또는 쿠키) |
| `POST /api/auth/logout` | `Set-Cookie` access + refresh `Max-Age=0`(만료) | `{success:true,data:null}` |
| `GET /api/auth/me` | (변경 없음 — 쿠키/헤더로 인증된 principal) | `AuthMeResponse` |

- `refresh` / `logout` 의 refresh token 입력: body(`RefreshTokenRequest`/`LogoutRequest`) 유지 + 쿠키 fallback 허용(쿠키 우선 여부 R1 구현 시 확정 — 003 body 테스트 보존 위해 body 우선 권장).

---

## 4. 카카오 콜백 (R-5) — OAuth2SuccessHandler

**현재**: `302` Location `{frontend}/auth/success#access=<jwt>&refresh=<pt>&...` (URL fragment)

**전환 후**:
```
Set-Cookie: access_token=...; refresh_token=...   (R-2 형식)
302 Found  Location: {frontend}/   (또는 /auth/success — fragment 없이)
```

- link flow(`linkUserId` 분기) = 토큰 미발급 → 현 `/auth/link-success` redirect 유지(변경 없음).
- 실패 핸들러(`OAuth2FailureHandler`) = 현 `/auth/login-error?code=...` redirect 유지.

---

## 5. CSRF / CORS (R-8, R-1)

- **CSRF**: `SecurityConfig.csrf().disable()` **유지**. same-origin + SameSite=Lax + 비-GET 상태변경 → CSRF 위험 완화. 추가 토큰 V1 미적용.
- **CORS**: same-origin 프록시라 교차 출처 불필요. 현 `CorsConfigurationSource` 는 직접 호출(프록시 미경유) 대비 유지 가능 — 제거 여부 R1 구현 시 영향 확인(003 테스트 정합).

---

## 6. 회귀 보존 (HARD-GATE)

- 003 의 헤더 기반 자동 회귀(`AuthControllerWebTest` body / `JwtAuthenticationFilterTest` 헤더 / `ProjectControllerIT` / OAuth 콜백 WebTest) **GREEN 유지**.
- 신규: 쿠키 read 케이스 + Set-Cookie 응답 케이스 + logout 만료 케이스.
- 진입 직전 `grep -rn "Authorization\|Bearer\|Set-Cookie" backend/src/test` 로 시그니처 확인(`agent-workflow-discipline §6`).
