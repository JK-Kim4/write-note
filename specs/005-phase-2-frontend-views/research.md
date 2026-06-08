# Phase 0 Research: 005 Frontend Views & Auth Integration

**Date**: 2026-05-28 | **Plan**: [plan.md](./plan.md)

본 문서는 spec.md 의 결정(인증 전체 동작 / httpOnly 쿠키 / 별도 페이지 + Clarifications same-origin 프록시)을 구현 가능한 형태로 박기 위한 Phase 0 검증·결정. 추측 영역은 실제 코드/타입 정의 검증 후 박음(`agent-workflow-discipline §1`).

---

## R-1. same-origin 프록시 — Next.js 16 rewrites

**Decision**: `frontend/next.config.ts` 의 `async rewrites()` 로 `/api/:path*` → backend(`http://localhost:8080/api/:path*` 로컬 / 배포는 env)로 프록시. 브라우저는 항상 frontend 출처(`localhost:3000`)만 보게 한다.

**Rationale**: Clarifications(2026-05-28) 의 same-origin 프록시 결정. 검증 — `frontend/node_modules/next/dist/server/config-shared.d.ts:919` 에 `rewrites?: () => Promise<Rewrite[] | {...}>` 지원 확인, `load-custom-routes.d.ts` 에 `Rewrite = { source, destination }` 타입 존재. Next.js dev server 와 Vercel 모두 rewrites 를 서버 레벨 프록시로 처리하므로 same-origin 유지 + Set-Cookie 헤더 전달. CORS 교차 출처 설정·SameSite=None 불필요.

**Alternatives considered**:
- cross-site 직접 호출(frontend → backend 다른 도메인): SameSite=None + Secure + CSRF 토큰 필요 → 배포 복잡도·CSRF 표면 증가. 사용자가 same-origin 프록시 선택(Clarifications).
- backend 무변경 + localStorage(헤더 인증): 사용자가 보안 우선으로 httpOnly 쿠키 선택 → 기각.

**확인 의무 (구현 시)**: rewrites 응답이 backend 의 `Set-Cookie` 헤더를 브라우저로 그대로 전달하는지 dogfooding 실측(R-2 와 연동). Next.js 16 breaking change 가능성 — 구현 시 `node_modules/next/dist/docs/` 의 rewrites 가이드 1회 정독(R-10 — 디렉토리 존재 확인됨).

---

## R-2. 쿠키 보안 속성

**Decision**: access/refresh 각각 별도 쿠키. 속성:
- `HttpOnly` = true (JS 접근 차단 — XSS 시 토큰 탈취 방지)
- `SameSite` = `Lax` (same-origin 이므로 충분)
- `Secure` = 환경별 — 로컬(http) `false`, 배포(https) `true`
- `Path` = `/`
- `Domain` = **미지정(host-only)** — 프록시 host(브라우저가 본 출처)에 귀속
- `Max-Age` = access 1h / refresh 30일 (JWT/AuthToken validity 정합)
- 쿠키명 후보: `access_token` / `refresh_token` (구현 시 확정)

**Rationale**: same-origin 프록시 하에서 host-only + Lax 면 브라우저가 같은 출처 요청에 자동 동봉. `Domain` 지정 시 프록시 host 와 불일치 위험 → 미지정이 안전. `Secure` 환경별 분리는 `ResponseCookie.secure(...)` 에 env 주입.

**Alternatives considered**:
- access+refresh 단일 쿠키(JSON): 파싱 복잡 + refresh 만 별도 만료 관리 어려움 → 분리.
- `SameSite=Strict`: same-origin 이라 Lax 로 충분 + Strict 는 외부 링크 진입 시 첫 요청 쿠키 누락 → Lax.

---

## R-3. JwtAuthenticationFilter 쿠키 read 병존

**Decision**: `JwtAuthenticationFilter` 가 `Authorization: Bearer` 헤더를 **우선** read, 없으면 쿠키(`access_token`)에서 read. 둘 다 없으면 pass-through(현 동작 유지).

**Rationale**: 003 의 헤더 기반 인증 자동 회귀 테스트(`JwtAuthenticationFilterTest` / `AuthControllerWebTest` / `ProjectControllerIT` 등)가 GREEN 유지되어야 함(HARD-GATE). 헤더 우선 + 쿠키 fallback 이면 기존 테스트 무변경 + 쿠키 케이스만 신규 추가. 실측 — 현 필터(`JwtAuthenticationFilter.kt:36`)는 `request.getHeader("Authorization")` 가 `Bearer eyJ` 접두사일 때만 검증, 그 외 pass-through → 쿠키 분기는 헤더 부재 시 추가.

**Alternatives considered**:
- 쿠키 우선: 003 테스트가 헤더 기반이라 회귀 위험. 헤더 우선이 003 보존에 안전.
- 헤더 완전 제거(쿠키 전용): 003 회귀 대량 발생 + ApiToken(Week 4 모바일) 은 헤더 유지 필요 → 병존이 안전.

**확인 의무**: 진입 직전 `grep -rn "Authorization\|Bearer" backend/src/test` 로 003 인증 테스트 시그니처 확인(`agent-workflow-discipline §6`).

---

## R-4. AuthController Set-Cookie 전환

**Decision**: `login` / `refresh` 응답에 `Set-Cookie`(access + refresh) 추가. `logout` 응답에 만료 쿠키(`Max-Age=0`). 응답 body 의 `TokenPairResponse` 는 **유지**(하위 호환 + 디버깅) 하되, frontend 는 body 토큰을 사용하지 않고 쿠키에 의존.

**Rationale**: `ResponseEntity` 에 `HttpHeaders.SET_COOKIE` 추가(`ResponseCookie.toString()`). body 유지 시 003 의 `AuthControllerWebTest`(body 검증)가 GREEN 유지 + 쿠키 검증 케이스 신규 추가. refresh 는 회전 정책(현 코드 주석 "직전 refresh 즉시 폐기")이라 매 refresh 마다 새 쿠키 Set.

**Alternatives considered**:
- body 토큰 완전 제거: 003 WebTest 회귀 + refresh 회전 응답 형식 변경 → body 유지가 안전(frontend 가 무시).
- 쿠키만 + body `null`: 위와 동일 회귀 → 기각.

---

## R-5. 카카오 콜백 쿠키화 (OAuth2SuccessHandler)

**Decision**: `OAuth2SuccessHandler` 의 `{frontend}/auth/success#access=...&refresh=...` URL fragment redirect → **Set-Cookie(access+refresh) 발급 후 `{frontend}/` (또는 `/auth/success`) redirect**(fragment 없이). same-origin 프록시 하에서 카카오 redirect_uri(`/api/auth/oauth/kakao/callback`)도 frontend 출처 경유 → 쿠키가 frontend 출처에 심김.

**Rationale**: 현 핸들러(`OAuth2SuccessHandler.kt:69`)는 `response.sendRedirect(fragment URL)`. 쿠키 전환 시 `response.addHeader("Set-Cookie", ...)` 후 fragment 없는 redirect. link flow(`linkUserId` 분기)는 토큰 미발급이라 영향 없음(현 `/auth/link-success` redirect 유지). `/auth/success` 라우트는 frontend 부재(실측) → 홈(`/`) redirect 또는 success 라우트 신설(R7 에서 결정).

**Alternatives considered**:
- fragment 유지 + frontend 가 fragment 파싱 후 쿠키 심기: httpOnly 쿠키는 JS 로 못 심음(서버만 Set-Cookie) → 불가. 서버 Set-Cookie 필수.

**확인 의무**: 카카오 redirect_uri 가 프록시 경유 시 쿠키 host 귀속 dogfooding 실측. 단 카카오 로그인은 외부 인가 화면 필요 → 로컬 dogfooding 제약(카카오 앱 설정 의존) — R7 에서 검증 범위 명시.

---

## R-6. 폼 검증 방식

**Decision**: V1 은 **네이티브 폼 + 최소 클라이언트 검증**(HTML5 `required`/`type` + 간단 onSubmit 검증). 서버 검증(400 응답 code/message)을 신뢰해 폼에 표시. react-hook-form/zod 등 신규 의존성 **미도입**.

**Rationale**: `~/.claude/rules` simplicity + 002 가 폼 컴포넌트(LoginForm 등)를 네이티브 `<form onSubmit>` 으로 박음. 검증 로직 대부분이 backend(이메일 형식/비밀번호 정책/title 길이)에 이미 존재(003/004 contract). 클라이언트 중복 검증 라이브러리는 V1 본인 1명 환경에 over-engineering. 서버 에러 code → 사용자 메시지 매핑만 frontend 책임.

**Alternatives considered**:
- react-hook-form + zod: 폼 많아지면 가치 있으나 V1 단순 폼(이메일/비번/title/메타) 에는 과함 + 신규 의존성. Week 3+ 폼 증가 시 재검토.

---

## R-7. refresh 트리거 + 인증 상태 판단

**Decision**:
- **refresh 트리거** = reactive. 보호 API 가 401 반환 시 `client.ts` 가 `POST /api/auth/refresh` 1회 호출 후 원요청 재시도. refresh 도 401 이면 인증 가드가 로그인으로 안내.
- **인증 상태 판단** = `GET /api/auth/me` 결과(200=로그인 / 401=비로그인). httpOnly 쿠키라 frontend JS 가 토큰/만료를 못 읽으므로 /me 가 단일 판단원. React Query 로 캐싱(`['auth','me']`).

**Rationale**: httpOnly 쿠키의 구조적 귀결 — JS 가 access token 만료 시각을 못 봄 → 선제(proactive) refresh 불가, reactive(401 감지)가 자연. /me 는 인증 가드(FR-025) + 헤더 사용자 정보 표시에 재사용.

**Alternatives considered**:
- proactive refresh(만료 시각 추적): httpOnly 라 만료 시각 접근 불가(별도 비-httpOnly 만료 힌트 쿠키 필요 → 복잡) → 기각.
- 비-httpOnly "logged-in" 플래그 쿠키: /me 1회 호출로 충분(React Query 캐싱) → V1 미도입.

---

## R-8. CSRF 정책

**Decision**: 현 `SecurityConfig.csrf().disable()` **유지**. same-origin + SameSite=Lax + 상태변경 비-GET(POST/PATCH/PUT/DELETE) 으로 CSRF 위험 구조적 완화. 추가 CSRF 토큰(double-submit) V1 미적용.

**Rationale**: spec FR-007 정합. SameSite=Lax 는 cross-site 비-GET 요청에 쿠키를 동봉하지 않음 → CSRF 주요 벡터 차단. 상태변경이 모두 비-GET 이라 Lax 만으로 방어. V1 본인 1명 환경에 CSRF 토큰은 over-engineering.

**Alternatives considered**:
- CSRF 토큰 활성화(Spring `CookieCsrfTokenRepository`): 방어 심층화이나 SameSite=Lax + same-origin 으로 이미 충분 + 토큰 동기화 복잡 → V2 후보.

---

## R-9. authPlaceholder store 처리

**Decision**: `frontend/src/stores/authPlaceholder.ts`(002 의 임시 `X-User-Id` 보관 store)를 **폐기**하고, 인증 상태는 React Query 의 `/me` 결과 + httpOnly 쿠키에 위임. `client.ts` 의 `useAuthPlaceholder.getState().userId` 의존 제거(ISSUE-015, FR-008).

**Rationale**: httpOnly 쿠키라 frontend 가 토큰/사용자 식별자를 직접 보관할 필요 없음. SC-008(X-User-Id grep 0건) 정합. store 폐기로 단일 인증 판단원(/me) 확립.

**Alternatives considered**:
- store 유지(userId 캐싱): httpOnly 쿠키와 이중 상태 → 불일치 위험. /me 단일화가 정합.

---

## R-10. ISSUE-003 재검증 — `node_modules/next/dist/docs/`

**Decision**: ISSUE-003(002 시점 `frontend/node_modules/next/dist/docs/` 부재로 `AGENTS.md` 정독 경고 무력화) 은 **현재 stale**. 실측 — 디렉토리 **존재 확인**(2026-05-28). 구현 시 rewrites/RSC 경계 가이드 정독 가능.

**Rationale**: `agent-workflow-discipline §5`(본질 정의 문서 정합성 검증) 절차로 추측 없이 실제 확인 → 002 시점과 환경 달라짐(pnpm install / Next 버전 차이 추정). vault `03-ISSUES.md` ISSUE-003 을 "재검증 결과 디렉토리 존재 → 경고 유효" 로 갱신 의무(별도 트랙).

**Alternatives considered**: 없음(사실 확인).

---

## R-11. 003/004 회귀 보존 + 검증 게이트

**Decision**: R1(쿠키 전환)이 003 인증 회귀를 깨지 않도록 — 헤더 인증 병존(R-3) + body 유지(R-4). 라운드별 좁은 검증 + 라운드 종료 시 전체 게이트:
- backend: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- frontend: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`(RSC 경계 검출 위해 build 의무 — 002 회귀)

**Rationale**: 003 의 `*Auth*` 좁은 게이트가 cross-suite 회귀를 놓친 전례(ISSUE-010) → 라운드 종료 시 전체 1회. frontend 는 `pnpm build` 로 server/client 경계 위반 검출(002 회귀 — lint 만으로 미검출).

**Alternatives considered**: 매 변경 전체 게이트 — 비용 과다(`long-running-bash.md`) → 좁은 + 종료 시 전체.

---

## 미해결 → tasks/구현 단계 위임

- 카카오 로컬 dogfooding 범위(외부 인가 화면 의존) — R7 task 에서 검증 가능 범위 명시.
- 쿠키명 최종 확정(`access_token`/`refresh_token`) — R1 구현 시.
- `/auth/success` 라우트 신설 vs 홈 redirect — R7 구현 시(R-5 연동).
- `components/projects/` 표시 컴포넌트 분해 단위 — 각 화면 라운드에서.
