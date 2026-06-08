# Frontend API Client — Contract

본 contract 는 Phase 1A backend (`/api/projects`) 와 본 spec 의 frontend 간 호출 contract 를 박는다. Phase 1A `Result<T>` envelope 를 클라이언트 측에서 일관 unwrap 하고, 임시 `X-User-Id` ownership 메커니즘과 정합한다. Week 1B-1~5 에서 본 client 는 JWT 기반으로 swap 된다.

## 1. Base URL

| 환경 | Base URL | 출처 |
|---|---|---|
| 로컬 개발 | `http://localhost:8080` | docker-compose + `./gradlew bootRun --args='--spring.profiles.active=local'` |
| 프로덕션 | `process.env.NEXT_PUBLIC_API_BASE_URL` | 본 spec land 후 Vercel 환경 변수 — Render backend URL (Week 1B / Week 7 영역에서 박힘) |

본 spec 시점에는 로컬 개발 fallback default 적용. 환경 변수 미설정 시 dev mode 에서 `http://localhost:8080` 사용.

## 2. Shared Headers (Phase 1A 정합)

`backend/spec.md §FR-007~009 + contracts/project-api.md` 의 shared headers 와 1:1 정합:

| Header | Required | Source |
|---|---:|---|
| `Content-Type: application/json` | Request body 가 있는 경우 | `fetch` 설정 |
| `X-User-Id` | Yes (Phase 1A 임시) | `lib/api/client.ts` 가 Zustand placeholder store 의 `auth.userId` 에서 자동 주입 |

### 2-1. 임시 X-User-Id 정책

- 본 spec 단계의 모든 backend 호출은 `lib/api/client.ts` 의 `withAuthHeaders()` 헬퍼를 거친다
- `auth.userId === null` 이면 호출하지 않고 즉시 `throw new UnauthenticatedError()` — `lib/auth/guard.ts` 의 라우트 가드와 정합
- Week 1B-5 진입 시 본 헬퍼 한 함수 swap = `Authorization: Bearer <jwt>` 추가 + `X-User-Id` 제거. 호출처 영향 없음 (단일 책임)

## 3. Response Envelope (Phase 1A 인용)

### 3-1. Success

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 3-2. Failure

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "title: must not be blank"
  }
}
```

## 4. Client Unwrap 규칙

`lib/api/client.ts` 의 `apiFetch<T>(path, init)` 가 envelope unwrap 담당:

```text
fetch(baseUrl + path, { ...init, headers: withAuthHeaders(init?.headers) })
  → response.ok === false → throw ApiError("HTTP_" + status, response.statusText)
  → JSON.parse(body) as Result<T>
  → result.success === true  → return result.data as T
  → result.success === false → throw ApiError(result.error.code, result.error.message)
  → JSON parse 실패 또는 network error → throw ApiError("NETWORK_ERROR", e.message)
```

### 4-1. ApiError shape

```text
class ApiError extends Error {
  constructor(code: string, message: string) { ... }
  code: string;    // backend ErrorCode 또는 client-side "HTTP_XXX" / "NETWORK_ERROR" / "UNAUTHENTICATED"
  message: string; // user-facing message
}
```

- React Query 의 `query.error` 가 ApiError 인스턴스. UI 컴포넌트는 `error.code` 로 분기 + `error.message` 표시 (DESIGN.md §핵심 인증 UX 결정 §6 "에러 메시지에 해결 경로 인라인 링크" 정합)

## 5. 본 spec 에서 호출하는 Endpoint (placeholder)

본 spec 은 FR-020 검증용 placeholder 호출 1 건만 박는다. 풀 사용은 Week 2.

### 5-1. List Active Projects (홈 동적 변형 분기)

```text
GET /api/projects?page=0&size=20&sort=updatedAt,desc
Headers: X-User-Id (auto)

응답: Page<ProjectResponse>
  content: ProjectResponse[]
  page: 0, size: 20, totalElements: number, totalPages: number

용도: app/page.tsx 의 totalElements === 0 → H0, > 0 → 일반 홈 분기
```

`lib/api/projects.ts`:

```text
export function listProjects(params: { page?: number; size?: number; sort?: string }) {
  return apiFetch<Page<ProjectResponse>>(`/api/projects?${qs(params)}`, { method: 'GET' });
}
```

React Query 사용처: `app/page.tsx` 안 `useQuery({ queryKey: ['projects', { page: 0, size: 20 }], queryFn: () => listProjects({ page: 0, size: 20, sort: 'updatedAt,desc' }) })`.

### 5-2. 본 spec 영역 밖 endpoint

Phase 1A backend 는 Create / Get / Update / Archive Project endpoint 도 제공하나, 본 spec 시점에는 호출하지 않는다 (Week 2 영역). 컴포넌트 placeholder 외관 (예: 작성 화면 top bar 의 프로젝트 타이틀) 는 정적 더미 값 사용.

## 6. CORS / 네트워크 정책

- Phase 1A backend 의 CORS allow-list 가 본 spec 의 frontend 개발 origin (`http://localhost:3000`) 을 포함하는지 검증 의무 — 미포함 시 본 plan land 전에 backend `application-local.yml` 또는 `CorsConfig.kt` 갱신 (별도 backend 변경, 본 spec 영역 밖)
- 프로덕션 origin (`https://<vercel-domain>`) 추가는 Week 7 (배포) 영역
- 본 client 는 `credentials: 'omit'` (X-User-Id placeholder 단계). Week 1B 의 JWT cookie 패턴 진입 시 `'include'` 로 swap

## 7. 에러 코드 매핑 (Phase 1A 정합)

`backend/error/ErrorCode.kt` 와 1:1 정합. 본 spec frontend 가 인지할 수 있는 backend 에러 코드:

| Code | HTTP | UI 처리 (본 spec) |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | `FormError` 인라인 표시 + 해당 필드 `FormInput.error` 표식 |
| `INVALID_PARAMETER` | 400 | `AlertError` 상단 박스 표시 |
| `NOT_FOUND` | 404 | `not-found.tsx` 또는 컨텍스트별 fallback |
| `INTERNAL_ERROR` | 500 | `AlertError` ("일시 오류 — 다시 시도해주세요") |
| `HTTP_XXX` (client-side) | — | `AlertError` ("연결 실패") |
| `NETWORK_ERROR` (client-side) | — | `AlertError` ("연결 실패") |
| `UNAUTHENTICATED` (client-side) | — | `router.push('/auth/login')` |

위 매핑은 본 spec 단계의 placeholder. Week 2 의 실제 사용 시점에 더 구체적 매핑 (예: `VALIDATION_FAILED` 의 field-level mapping) 박힘.

## 8. 후속 phase 합류 예정

- Week 1B-1 Spring Security + JWT util 진입 시 본 client 의 `withAuthHeaders()` 가 `Authorization: Bearer <jwt>` 주입 + `X-User-Id` 제거. `lib/auth/guard.ts` 는 cookie 기반 세션 신호로 swap
- Week 1B-3/4 Kakao OAuth / 이메일·비번 로그인 진입 시 `/api/auth/*` endpoint 추가
- Week 2 Project CRUD 본 사용 시 본 spec 의 placeholder query 가 실제 사용 단위로 확장
- Week 4 메모 캡처 (`/api/capture` + ApiToken Filter) 는 본 client 와 별도 (`X-Api-Token` header — `docs/plan §4` 박힘)
