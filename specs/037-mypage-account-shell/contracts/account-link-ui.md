# Contract: 계정 연결 UI — 기존 endpoint 재사용

037 은 새 백엔드 endpoint 를 만들지 않고 기존 인증 연결 흐름을 프론트에서 호출한다.

## 비밀번호 추가 등록 (카카오 가입자)

### POST /api/auth/link/email  (기존)

```json
{ "password": "..." }
```

- 인증: Bearer JWT.
- 성공 200: `LinkEmailResponse { userId, email, passwordSet: true }`.
- 실패: 이미 설정됨 → 409 `PASSWORD_ALREADY_SET` / 약한 비밀번호 → 400 `PASSWORD_TOO_WEAK`.
- 프론트: 공용 client(`apiFetch`, `retryOnAuthFailure` 보호 endpoint). 성공 시 `["auth","me"]` invalidate.
- ⚠️ 409 분기는 **error.code 기준**(`PASSWORD_ALREADY_SET`) — 일반 ApiError 흐름(code-quality §409).

## 카카오 추가 연결 시작 (이메일 가입자)

### POST /api/auth/link/kakao  (기존)

- 인증: Bearer JWT.
- 동작: session 에 linkUserId 박고 **302 `Location: /api/auth/oauth/kakao`** 반환(이후 Spring Security OAuth 흐름).
- 콜백 후: `KakaoOAuth2UserService` 가 session 분기 → 연결 성공 시 `link-success` 페이지.

### ⚠️ 브라우저 트리거 방식 — R2 실측 (불확실)

POST + 302 + 외부 OAuth 조합이라 fetch 단독으로 매끈하지 않다. R2 에서 다음을 실측해 확정:
- **잠정**: 공용 client 로 POST(`X-WriteNote-Client` 헤더·`credentials:include`) → 성공/302 확인 후 `window.location.href = "/api/auth/oauth/kakao"` 로 OAuth 진입.
- 검증 포인트(dogfooding): (a) CsrfDefenseFilter 가 헤더 요구를 통과시키는가, (b) session(linkUserId)이 OAuth 콜백까지 유지되는가, (c) fetch `redirect:'manual'` opaque 처리.
- 안 되는 대안: `<form method=post>`(CSRF 커스텀 헤더 불가) / `window.location` GET(POST endpoint 라 405).

## 연결 성공 후 목적지

- `auth/link-success` 페이지의 안내 목적지를 `/settings` → `/mypage/connections` 로 변경(FR-014).

## 신규 백엔드 변경
- 없음(endpoint 재사용). 단 `AuthMeResponse.passwordSet` additive(별도 contract: auth-me-passwordset.md).
