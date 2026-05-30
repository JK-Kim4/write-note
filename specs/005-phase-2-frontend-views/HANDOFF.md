# 005 MVP 구현 인수문서 (Session Handoff)

**작성일**: 2026-05-30
**브랜치**: `005-phase-2-frontend-views` (working tree 다수 미커밋)
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) | **Tasks**: [tasks.md](./tasks.md)
**합의 (2026-05-29)**: **MVP 단위 (R1 인증 쿠키 전환 + US1 로그인+홈) 진행 → 사용자 검증 후 US2~US6 결정**

---

## 0. 다음 세션 진입 프롬프트 (그대로 복사)

```
write-note 005 MVP 구현을 이어서 진행한다.

세션 진입 절차:
1. specs/005-phase-2-frontend-views/HANDOFF.md 정독 (현재 상태 + 남은 작업 + 권장 순서)
2. ~/obsidian/write-note/02-PROGRESS.md §2 확인 (브랜치 무관 진척 요약)
3. specs/005-phase-2-frontend-views/tasks.md 의 [X] 마킹 확인 (T001~T009, T011, T012 완료)
4. T010 부터 진행: AuthControllerWebTest 쿠키 케이스 → T013 backend 전체 게이트 (docker postgres 사전 기동) → R1 frontend T014~T021 → US1 T022~T026

MVP 목표: 로그인 → 홈 프로젝트 목록 실데이터 동작 + 새로고침 세션 유지 (T051 재검증, SC-001/002/003/005).
```

---

## 1. 현재 상태 (완료 / 미완)

### ✅ 완료

#### Phase 1 Setup (T001~T004)

- **T001** — 003 인증 테스트 시그니처 grep 기준선 확정. **헤더 사용 GREEN 유지 대상 7종**: `AuthControllerWebTest` / `AuthOauthCallbackWebTest` / `ProjectControllerIT` / `CharacterControllerIT` / `ProjectControllerOwnerCleanupTest` / `AccountLinkWebTest` / `KakaoOAuth2UserServiceTest`
- **T002** — frontend 테스트 의존성 설치. **Node v20.10 제약으로 vitest3+vite5+plugin-react4 고정** (회고 후보, [[03-ISSUES]] ISSUE-016). 실제 설치: vitest 3.2.4 / vite 5.4.21 / @vitejs/plugin-react 4.7.0 / @testing-library/react 16.3.2 / @testing-library/jest-dom 6.9.1 / @testing-library/user-event 14.6.1 / msw 2.14.6 / jsdom 29.1.1
- **T003** — `frontend/vitest.config.ts` (jsdom + alias `@/` + `setupFiles` + `passWithNoTests: true`) + `frontend/src/test/setup.ts` (jest-dom + msw lifecycle) + `frontend/src/test/msw/server.ts`
- **T004** — `frontend/package.json` scripts: `"test": "vitest run"` + `"typecheck": "tsc --noEmit"`. `pnpm typecheck && pnpm test` 통과 확인

#### Phase 2 Foundational R1 backend 코어 (T005~T009, T011, T012)

- **T005** `backend/.../auth/AuthCookieFactory.kt` 신설 — Spring `ResponseCookie`, SameSite=Lax+HttpOnly+Path=/+Secure(env)+Max-Age. `accessTokenCookie` / `refreshTokenCookie` / `expiredAccessTokenCookie` / `expiredRefreshTokenCookie` 4 helper. 쿠키명 상수: `access_token` / `refresh_token`
- **T006** `AuthCookieFactoryTest.kt` 신규 4 케이스 (속성 / refresh maxAge / 만료 / secure flag)
- **T007** `JwtAuthenticationFilter` 쿠키 read 병존 — 헤더 `Bearer eyJ` 우선, 부재 시 `access_token` 쿠키 read (빈 값 가드), 둘 다 부재 pass-through. `resolveToken(request)` 헬퍼 추가
- **T008** `JwtAuthenticationFilterTest.kt` 신규 5 케이스 (헤더 / 쿠키 / 헤더 우선 / 무토큰 pass-through / 무효 토큰 401)
- **T009** `AuthController` Set-Cookie — login/refresh 가 `tokenPairResponse(pair)` 헬퍼 경유, ResponseEntity 에 access/refresh 쿠키 헤더 + body `TokenPairResponse` 유지 (003 호환). logout 응답에 만료 쿠키 (Max-Age=0). 생성자에 `authCookieFactory` 주입
- **T011** `OAuth2SuccessHandler` 쿠키화 — URL fragment redirect 삭제, Set-Cookie(access+refresh) 후 `{frontend}/` redirect. link flow(`linkUserId`) 분기 유지. URLEncoder/UTF_8 import 제거. `OAuth2SuccessHandlerTest` 쿠키 검증으로 갱신 (handler 생성자에 `authCookieFactory` 주입)
- **T012** `SecurityConfig` 검토 — same-origin + SameSite=Lax + 비-GET 상태변경 → `csrf().disable()` 유지, CORS 직접 호출 대비 유지. **코드 변경 없음** 확정
- **yml** — `application.yml` 에 `app.cookie.secure: false` + `application-prod.yml` 에 `app.cookie.secure: true`

#### 검증 결과

`cd backend && ./gradlew ktlintFormat test --tests "*AuthCookieFactory*" --tests "*JwtAuthenticationFilterTest*" --tests "*OAuth2SuccessHandler*"` → **BUILD SUCCESSFUL (13s)**. 신규 단위 3종 10케이스 GREEN, 컴파일 정상. ktlintFormat 이 `AuthCookieFactory` expression body 를 single-line 으로 자동 포맷.

#### 부수 산출물

- `CLAUDE.md` SPECKIT 마커 → 005 plan 으로 갱신
- vault `02-PROGRESS.md` / `03-ISSUES.md` (ISSUE-003 해소 / ISSUE-015 진행 / ISSUE-016 신규) 갱신
- `specs/005-phase-2-frontend-views/` 전체 산출물 (spec / plan / research R-1~R-11 / data-model / contracts 3종 / quickstart / checklists/requirements 전 항목 ✓ / tasks 마킹)

---

### ⏳ 미완 (이번 세션 목표)

#### A. T010 — AuthControllerWebTest 쿠키 케이스 추가

- **파일**: `backend/src/test/kotlin/com/writenote/controller/AuthControllerWebTest.kt`
- **목표**: login/refresh Set-Cookie 응답 검증 + logout Max-Age=0 만료 쿠키 + **003 body 케이스 GREEN 유지** (헤더 병존 보존)
- **진입 직전 의무** (`agent-workflow-discipline §6`): 기존 파일 정독 → 기존 케이스 패턴 따름. MockMvc `result.response.cookies` 또는 `header().string("Set-Cookie", ...)` 패턴
- **추가 케이스 후보**:
  - `should set access_token and refresh_token cookies on login success`
  - `should set new cookies on refresh (회전)`
  - `should expire cookies (Max-Age=0) on logout`
  - 기존 body 검증은 유지

#### B. T013 — backend 전체 게이트

- **사전 조건**: `docker compose up -d --wait postgres` (IT/Testcontainers 필요)
- **명령**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- **검증 대상**: 003 헤더 회귀 GREEN 유지 (`AuthControllerWebTest`/`ProjectControllerIT` body) + 신규 쿠키 케이스 + 004 도메인 회귀 (`ProjectController`/`CharacterController` IT)
- **포어그라운드 의무** (CLAUDE.md): 결과 확인 후 다음
- **실패 시**: gradle 출력 → 실패 테스트명 → 해당 영역 fix. ISSUE-010 교훈 (좁은 게이트 금지 — 전체 1회)

#### C. R1 frontend (T014~T021)

| Task | 파일 | 핵심 |
|---|---|---|
| T014 | `frontend/next.config.ts` | `async rewrites()` 로 `/api/:path*` → `${BACKEND_ORIGIN ?? "http://localhost:8080"}/api/:path*` |
| T015 | `frontend/src/lib/api/client.ts` | X-User-Id 제거 + `useAuthPlaceholder` 제거 + same-origin 상대 경로 + `credentials:"include"` + 401 reactive refresh (1회, refresh path 자체는 재시도 X) |
| T016 | `frontend/src/lib/api/client.test.ts` | msw — (a) 200 unwrap (b) 401→refresh 200→재시도 200 (c) 401→refresh 401→throw |
| T017 | `frontend/src/stores/authPlaceholder.ts` | 폐기 + `grep -rn "authPlaceholder\|X-User-Id\|useAuthPlaceholder" frontend/src` = 0건 (SC-008) |
| T018 | `frontend/src/lib/api/auth.ts` | 신설 — login/signupEmail/verifyEmail/requestPasswordReset/confirmPasswordReset/fetchMe/logout (body 무시, 쿠키 의존) |
| T019 | `frontend/src/lib/auth/guard.ts` | `useQuery(['auth','me'], fetchMe, {retry:false})` 기반 requireAuth/guestOnly. 401 시 `router.replace('/auth/login')` |
| T020 | `frontend/src/types/api.ts` | Project / Character / AuthMe / PagedResult<T> (data-model.md 정합) |
| T021 | (게이트) | `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`. RSC 경계 검출 위해 build 의무 (002 회귀) |

#### D. US1 MVP (T022~T026)

| Task | 파일 / 동작 |
|---|---|
| T022 | `frontend/src/components/auth/LoginForm.tsx` — 기존 정적 외관에 `'use client'` + `useMutation(login)` + 성공 시 `['auth','me']` 무효화 + `router.push('/')` + 실패 code 매핑(EMAIL_NOT_VERIFIED / LOGIN_FAILED / LOGIN_LOCKED) |
| T023 | `LoginForm.test.tsx` — msw 성공 + 실패 code 표시 |
| T024 | `frontend/src/app/page.tsx` — 기존 `listProjects` query 검증 + **에러 상태와 빈 상태 분리** (현재 `isError → empty 취급` → 에러는 재시도 표시) |
| T025 | 인증 가드 redirect 브라우저 실측 (비로그인 → `/auth/login`) |
| T026 | **T051 재검증** — backend bootRun(local) + frontend dev → 로그인 → 홈 목록 unwrap GREEN (이전 401 회귀 해소, SC-002) |

#### MVP 종료 시점

- backend + frontend 모든 게이트 GREEN
- 사용자 dogfooding: 로그인 → 홈 목록 + 새로고침 세션 유지 (SC-001/002/003/005)
- commit 권장 단위: (1) backend R1+setup (2) frontend R1 (3) US1 (또는 1 묶음)

---

## 2. 참조 순서 (다음 세션 Claude 가 컨텍스트 0 진입 시)

| # | 파일 | 핵심 |
|---|---|---|
| 1 | 본 `HANDOFF.md` | 현재 상태 + 남은 작업 |
| 2 | `~/obsidian/write-note/02-PROGRESS.md` §2 | 브랜치 무관 진척 요약 |
| 3 | `tasks.md` | 55 task 체크리스트 (T001~T009/T011/T012 [X]) |
| 4 | `spec.md` Clarifications | same-origin 프록시 결정 |
| 5 | `research.md` R-3 / R-7 / R-9 | 쿠키 read 병존 / reactive refresh / authPlaceholder 폐기 |
| 6 | `contracts/auth-cookie-contract.md` | 쿠키 인증 contract (T010 참고) |
| 7 | `contracts/proxy-and-client.md` | frontend client swap 시그니처 + 가드 (R1 frontend) |
| 8 | `contracts/screen-data-flow.md` | 화면별 query/mutation ↔ endpoint (US1) |
| 9 | `quickstart.md` §3 | dogfooding 절차 (T026 / MVP 종료 검증) |

---

## 3. 환경 메모

- **Node** v20.10.0 (nvm). vitest 4 / vite 7 비호환 → 정정됨 (위 ISSUE-016)
- **frontend** dev port 3000, **backend** 8080
- **docker postgres** 컨테이너명: `write-note-postgres`. 기동: `docker compose up -d --wait postgres`
- **새 세션 working dir 기본**: repo root (`/Users/jongwan-air/Desktop/workspaces/write-note`). 이전 세션의 `cd frontend`/`cd backend` 는 persist 안 됨 — 절대 경로 또는 명시 cd

---

## 4. CLAUDE.md HARD-GATE 재확인 (생략 금지)

- **추측 금지 + 단정 금지** — 코드/문서 직접 확인 후 진행
- **빌드/테스트 포어그라운드** (`run_in_background=false`), 결과 확인 후 다음
- **`agent-workflow-discipline §6`**: tasks 명시 영역(파일명/시그니처)은 진입 직전 grep 으로 실측
- **RSC 경계** (002 회귀): `'use client'` 의무 컴포넌트는 page 작성 직후 `pnpm build` 검증
- **TDD HARD-GATE**: 로직 RED→GREEN, 정적 외관·라우트 골격·타입 선언은 완화(§5-5)
- **DB 변경/쓰기 0** (본 spec 영역) — `.env` 무단 Read 금지 (`external-infra-safety.md`)
- **003 헤더 회귀 보존** (R-3 병존) — gradle 게이트 GREEN 의무

---

## 5. 미커밋 변경 목록 (2026-05-30 시점)

```
# backend
backend/src/main/kotlin/com/writenote/auth/AuthCookieFactory.kt          [신규]
backend/src/main/kotlin/com/writenote/auth/JwtAuthenticationFilter.kt    [수정 — 쿠키 read 병존]
backend/src/main/kotlin/com/writenote/auth/OAuth2SuccessHandler.kt       [수정 — 쿠키화]
backend/src/main/kotlin/com/writenote/controller/AuthController.kt       [수정 — Set-Cookie + 헬퍼]
backend/src/main/resources/application.yml                                [수정 — app.cookie.secure: false]
backend/src/main/resources/application-prod.yml                           [수정 — app.cookie.secure: true]
backend/src/test/kotlin/com/writenote/auth/AuthCookieFactoryTest.kt       [신규]
backend/src/test/kotlin/com/writenote/auth/JwtAuthenticationFilterTest.kt [신규]
backend/src/test/kotlin/com/writenote/auth/OAuth2SuccessHandlerTest.kt    [수정 — 쿠키 검증]

# frontend
frontend/package.json                                                     [수정 — devDeps + scripts]
frontend/pnpm-lock.yaml                                                   [자동]
frontend/vitest.config.ts                                                 [신규]
frontend/src/test/setup.ts                                                [신규]
frontend/src/test/msw/server.ts                                           [신규]

# specs (전체 산출물 + tasks 마킹)
specs/005-phase-2-frontend-views/                                         [전체 신규]
  ├── spec.md (Clarifications 포함)
  ├── plan.md
  ├── research.md (R-1~R-11)
  ├── data-model.md
  ├── contracts/{auth-cookie-contract.md, proxy-and-client.md, screen-data-flow.md}
  ├── quickstart.md
  ├── tasks.md (T001~T009, T011, T012 [X])
  ├── checklists/requirements.md (전 항목 ✓)
  └── HANDOFF.md (본 파일)

# 본 repo 메타
CLAUDE.md                                                                 [수정 — SPECKIT 마커]
.specify/feature.json                                                     [수정 — feature_directory]

# vault (별도 워크트리)
~/obsidian/write-note/02-PROGRESS.md                                      [수정 — 진척 갱신]
~/obsidian/write-note/03-ISSUES.md                                        [수정 — ISSUE-003 해소 / 015 진행 / 016 신규]
```

**커밋 권장 분기**: (1) specs + 메타 (2) backend R1+setup (3) frontend setup+R1 (4) US1 (5) vault — 또는 한 묶음 commit (사용자 선택).
