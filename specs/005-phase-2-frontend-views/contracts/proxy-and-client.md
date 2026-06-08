# Contract: Proxy & Client

**Date**: 2026-05-28 | **Plan**: [../plan.md](../plan.md) | **Research**: R-1, R-7, R-9

frontend 의 same-origin 프록시 + API client swap + 인증 가드 계약. 영향 파일: `next.config.ts` / `lib/api/client.ts` / `lib/api/{auth,projects,characters}.ts` / `lib/auth/guard.ts` / `stores/authPlaceholder.ts`(폐기).

---

## 1. next.config.ts rewrites (R-1)

```ts
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
    ];
  },
};
```

- `BACKEND_ORIGIN` = env(`BACKEND_ORIGIN` 또는 기존 `NEXT_PUBLIC_API_BASE_URL` 재활용) — 로컬 `http://localhost:8080`.
- 브라우저는 `localhost:3000/api/*` 만 호출 → same-origin. Next 서버가 backend 프록시. Set-Cookie 헤더 전달(R-2 dogfooding 검증).

---

## 2. client.ts swap (R-9, FR-008)

**제거**:
- `useAuthPlaceholder.getState().userId` 의존
- `X-User-Id` 헤더 주입
- `UnauthenticatedError` 선차단(userId 없을 때) — 쿠키 인증으로 대체

**유지/추가**:
- base path = same-origin 상대 경로(`/api/...`) — `DEFAULT_BASE_URL` 절대 host 제거 또는 빈 문자열(프록시 경유)
- `credentials: "include"`(same-origin 이라 기본 동봉이나 명시) — 쿠키 자동 전송
- `Result<T>` envelope unwrap 유지
- **401 reactive refresh(R-7)**: 보호 요청 401 → `POST /api/auth/refresh` 1회 → 성공 시 원요청 재시도 / 실패 시 throw(가드가 로그인 안내). 무한 루프 방지(refresh 자체 401 은 재시도 안 함).

---

## 3. 인증 가드 (R-7, FR-025) — lib/auth/guard.ts

- `useAuthGuard("requireAuth")` = `useQuery(['auth','me'])` 결과로 판단.
  - 200 → 통과
  - 401 → 로그인(`/auth/login`)으로 redirect
- `useAuthGuard("guestOnly")`(로그인 화면) = 로그인 상태면 홈 redirect.

---

## 4. API 함수 시그니처

### lib/api/auth.ts (신설)

| 함수 | 호출 | 반환 |
|---|---|---|
| `login(input)` | POST /api/auth/login | void(쿠키) |
| `signupEmail(input)` | POST /api/auth/signup/email | SignupResult |
| `verifyEmail(token)` | POST /api/auth/verify-email | void |
| `requestPasswordReset(email)` | POST /api/auth/password-reset/request | void |
| `confirmPasswordReset(input)` | POST /api/auth/password-reset/confirm | void |
| `fetchMe()` | GET /api/auth/me | AuthMe |
| `logout()` | POST /api/auth/logout | void |

### lib/api/projects.ts (확장 — 기존 listProjects)

| 함수 | 호출 |
|---|---|
| `listProjects({archived,page,size,sort})` | GET /api/projects |
| `getProject(id)` | GET /api/projects/{id} |
| `createProject(input)` | POST /api/projects |
| `updateProject(id, input)` | PATCH /api/projects/{id} |
| `archiveProject(id)` | POST /api/projects/{id}/archive |
| `unarchiveProject(id)` | POST /api/projects/{id}/unarchive |
| `deleteProject(id)` | DELETE /api/projects/{id} |

### lib/api/characters.ts (신설)

| 함수 | 호출 |
|---|---|
| `listCharacters(projectId, {page,size})` | GET /api/projects/{pid}/characters |
| `getCharacter(projectId, id)` | GET .../{id} |
| `createCharacter(projectId, input)` | POST .../characters |
| `updateCharacter(projectId, id, input)` | PATCH .../{id} |
| `reorderCharacters(projectId, characterIds)` | PUT .../reorder |
| `deleteCharacter(projectId, id)` | DELETE .../{id} |

모든 함수 = `apiFetch<T>` 경유(envelope unwrap + 쿠키 자동).

---

## 5. SC-008 검증

`grep -rn "X-User-Id" frontend/src` = **0건** 의무(FR-008). `authPlaceholder.ts` 폐기 후 잔존 import 0건.
