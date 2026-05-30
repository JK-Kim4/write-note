# Implementation Plan: 005 Phase 2 Frontend Views & Auth Integration

**Branch**: `005-phase-2-frontend-views` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-phase-2-frontend-views/spec.md`

## Summary

002 가 만든 정적 라우트 골격 + 003 의 JWT 인증 + 004 의 Project/Character API 위에 **Week 2 프론트엔드 전체** 를 박고, 동시에 **인증 전달 매체를 헤더 → httpOnly 쿠키로 전환**한다. 본 spec 은 이전 phase(001~004 = 단일 영역)와 달리 **frontend + backend 혼합 phase** 다.

핵심 산출물 2축:

1. **인증 통합 (foundational)** — backend 003 인증을 쿠키 기반으로 전환: `JwtAuthenticationFilter` 가 쿠키에서 토큰 read, `AuthController` login/refresh/logout 이 `Set-Cookie` 발급, `OAuth2SuccessHandler` 가 URL fragment → 쿠키 발급으로 전환. frontend 는 `next.config.ts` rewrites 로 `/api/*` 를 backend 로 same-origin 프록시(Clarifications 2026-05-28) + `client.ts` 의 임시 `X-User-Id` 제거 + 인증 가드(`/api/auth/me` 기반). → cross-site 쿠키 제약·CORS 회피, SameSite=Lax 통일.
2. **데이터 화면 4종** — 홈 view(실데이터) + 새 프로젝트(`/projects/new`) + 프로젝트 메타 카드/편집(`/projects/{id}`, 전용 편집) + 등장인물(`/projects/{id}/characters`). 인증 폼 4종(로그인/회원가입+인증/비밀번호 재설정/카카오)도 정적 외관 → 실동작.

User Story 우선순위(P1 로그인+홈 → P6 카카오)에 맞춰 라운드 분해한다.

## Technical Context

**Language/Version**:
- frontend: TypeScript 5.9 + React 19.2.4 on Next.js **16.2.6** (App Router). `frontend/package.json` 실측.
- backend: Kotlin 2.2.21 on Java 24 toolchain (003/004 그대로, 본 spec 신규 backend 의존성 없음).

**Primary Dependencies**:
- frontend (기존 002 도입): `@tanstack/react-query`(서버 상태), `zustand`(로컬 UI). 본 spec 신규 추가 후보 = 폼 검증 라이브러리 여부 — research 결정(R-6). TipTap 은 본 spec 미적용(Week 3).
- backend (기존 003/004): spring-boot-starter-{web,security,data-jpa,validation,oauth2-client,mail} 4.0.6, jjwt 0.12.x. 본 spec 신규 backend 의존성 = **없음** — 쿠키 전환은 Spring `ResponseCookie` + `HttpServletRequest.cookies` 표준 API 안에서 완결.

**Storage**:
- DB 변경 **없음**. 쿠키 전환은 토큰 *전달 매체* 만 바꾼다 — `auth_tokens` 테이블(refresh hash 저장) / `users` 는 그대로. **새 Flyway 마이그레이션 0건.**
- 세션 토큰 = httpOnly 쿠키(브라우저 저장, JS 접근 불가). access(JWT, 1h) + refresh(평문, 30일) 각각 쿠키.

**Testing**:
- backend 단위/통합: JUnit 5 + AssertJ + MockK + Testcontainers. 003 의 인증 회귀(AuthControllerWebTest / JwtAuthenticationFilter / OAuth2 콜백 WebTest)를 **헤더 케이스 유지 + 쿠키 케이스 추가**로 확장. `LoginAttemptProductionIT` 패턴(클래스 레벨 `@Transactional` 폐기)은 본 spec 의 쿠키 전환 영역에는 불필요(트랜잭션 흐름 검증 아님).
- frontend: Vitest(단위) + React Testing Library(행위 — `getByRole`/`getByText`) + MSW(HTTP 경계 mock). E2E 골든패스 1건(로그인 → 홈 → 새 프로젝트)은 Playwright(선택, Week 7 통합 영역과 정합 검토).
- **server/client 경계 HARD-GATE**(002 회귀 사례 — `.claude/rules/typescript/code-quality.md`): 이벤트 핸들러/hook 컴포넌트 `'use client'` 의무. page 작성 직후 `pnpm build` 검증(lint 만으로 RSC 경계 위반 미검출).
- **한국어 검증 cadence**(HARD-GATE): 한국어 렌더링 영역 dogfooding(라이트/다크).
- 검증 게이트: backend `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` / frontend `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

**Target Platform**: 로컬 dev(macOS Darwin 25 — frontend `localhost:3000` next dev + backend `localhost:8080` bootRun) 중심(Week 2 dogfooding). 배포(Vercel + Render)는 Week 7 — 단 same-origin 프록시 결정으로 배포 시 쿠키 전략 재작업 회피.

**Project Type**: Monorepo web application — 본 feature 는 `frontend/`(주) + `backend/`(인증 쿠키 전환) **양쪽** 변경. 이전 phase 와 다른 점.

**Performance Goals**: 본인 1명 dogfooding(V1). 로그인 후 홈 목록 체감 3초 이내(SC-001). 세션 새로고침 유지 100% 재현(SC-003).

**Constraints**:
- **same-origin 프록시 (Clarifications)**: `next.config.ts` 의 `async rewrites()` 로 `/api/:path*` → backend 로 프록시. 검증 완료 — `node_modules/next/dist/server/config-shared.d.ts` 에 `rewrites?: () => Promise<Rewrite[]>` 지원(research R-1). 브라우저 관점 same-origin → CORS 불필요, SameSite=Lax.
- **httpOnly 쿠키 보안**: `HttpOnly` + `SameSite=Lax` + `Path=/`. `Secure` 는 환경별(로컬 http=false / 배포 https=true). 쿠키 `Domain` 미지정(host-only) — 프록시 host(브라우저가 본 출처)에 귀속(research R-2).
- **CSRF**: same-origin + SameSite=Lax + 상태변경 비-GET → 현 `csrf().disable()` 유지 가능(FR-007). 추가 CSRF 토큰은 V1 미적용(over-engineering — 본인 1명).
- **외부 인프라 안전 (HARD-GATE)**: `.claude/rules/infra/external-infra-safety.md`. 본 spec DB 쓰기/마이그레이션 **없음** — dogfooding 시 로컬 docker postgres 읽기/기존 API 호출만. `.env` 무단 Read 금지.
- **003 인증 회귀 차단 (HARD-GATE)**: 쿠키 read 는 헤더 read 와 **병존**(헤더 우선 또는 쿠키 fallback) — 003 의 헤더 기반 자동 회귀 테스트가 GREEN 유지되어야 함. `agent-workflow-discipline §6` — 실제 코드 grep 후 진입.
- **TS/Kotlin 코드 품질**: `.claude/rules/typescript/code-quality.md`(named export, `type` 우선, RSC 경계) + `.claude/rules/kotlin/code-quality.md`(배열 annotation 인자 등).
- **Subagent dispatch cost**: 혼합 phase(LOC 큼) — 라운드 분해 의무. 위임 시 dispatch 체크리스트(검증 2개 이하 / commit 금지 / tool_uses 50 cap / 재시도 3회 금지) 적용(`agent-workflow-discipline §4`).

**Scale/Scope**:
- 화면: 홈(검증·완성) + 새 프로젝트(신설) + 메타 카드(신설) + 메타 편집(신설) + 등장인물(신설) + 인증 폼 4종(실동작) ≈ 9~10 화면/흐름.
- backend 변경 파일: `JwtAuthenticationFilter` / `AuthController` / `OAuth2SuccessHandler` / `SecurityConfig`(검토) + 쿠키 helper 1 ≈ 4~5 파일 + 회귀 테스트 확장.
- frontend 신규/변경: `next.config.ts` + `client.ts` + API 함수(projects/characters/auth) + 인증 lib(가드/로그인 mutation/me) + 화면 5종 + 폼 4종 실동작.
- `multi-round-implementation.md` 의 "다중 화면 / 혼합 영역 / TDD 의무" → 라운드 분해(아래 §라운드 분해).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 default placeholder. effective gates 는 프로젝트 SoT + 글로벌·프로젝트 룰에서 도출(003/004 plan 양식 정합):

- **Context persistence gate**: 산출물(spec/plan/research/data-model/contracts/quickstart/checklists) 을 `specs/005-phase-2-frontend-views/` 에 박고, 루트 `CLAUDE.md` SPECKIT 마커를 본 plan 으로 갱신.
- **same-origin 프록시 gate (Clarifications 결정)**: frontend `/api/*` 는 `next.config.ts` rewrites 로 backend 프록시. CORS 교차 출처 설정 불필요. 쿠키 SameSite=Lax 통일.
- **003 인증 회귀 차단 gate (HARD-GATE)**: 쿠키 read 는 헤더 read 와 병존 → 003 의 헤더 기반 인증 자동 회귀 GREEN 유지. 쿠키 케이스는 신규 추가. 진입 직전 `grep` 으로 003 인증 테스트 시그니처 확인(`agent-workflow-discipline §6`).
- **server/client 경계 gate (HARD-GATE, 002 회귀)**: 이벤트 핸들러/hook 컴포넌트 `'use client'`. page 작성 직후 `pnpm build`.
- **Quality gate**: backend `ktlint*+checkstyleMain+test+build` GREEN / frontend `pnpm lint+typecheck+test+build` GREEN.
- **TDD HARD-GATE**: 쿠키 인증(필터 쿠키 read 분기 / Set-Cookie 발급 / logout 만료), 로그인 mutation, 인증 가드(/me 401 분기), 프로젝트·등장인물 매핑·상태전이(생성/부분수정/archive/reorder). RED → GREEN. (정적 외관 컴포넌트·라우트 골격·타입 선언은 TDD 완화 영역 §5-5)
- **API contract gate**: 모든 응답 `Result<T>` envelope(001). frontend `apiFetch` 가 unwrap. 쿠키 인증 contract 신설(contracts/).
- **한국어 cadence gate (HARD-GATE)**: 한국어 렌더링·입력 영역 dogfooding(라이트/다크). 폰트 fallback chain(002 도입) 정합.
- **Subagent dispatch cost gate**: 라운드 분해 + LOC 큰 라운드만 위임 검토. dispatch 체크리스트 적용.
- **N+1 / 외부 인프라**: 본 spec frontend 중심 + backend 쿠키 전환만 → 신규 DB 쿼리 없음(004 의 N+1 회피 그대로). DB 쓰기/마이그레이션 0.

**Initial gate status: PASS**. Complexity Tracking 위반 후보 1건 — same-origin 프록시(rewrites)가 "새 인프라 레이어"인지 검토(아래 Complexity Tracking).

## 라운드 분해 (혼합 phase — tasks.md 가 상세화)

| 라운드 | User Story | 영역 | 산출물 개요 |
|---|---|---|---|
| **R1 인증 쿠키 전환 (foundational)** | US1 전제 | backend + frontend | `JwtAuthenticationFilter` 쿠키 read 병존 / `AuthController` login·refresh·logout Set-Cookie / 쿠키 helper / `OAuth2SuccessHandler` 쿠키화 / `next.config.ts` rewrites / `client.ts` X-User-Id 제거 + 인증 가드(/me) / 003 회귀 유지 + 쿠키 케이스 추가 |
| **R2 이메일 로그인 + 홈 실데이터** | US1 (P1) | frontend | 로그인 폼 실동작(POST /api/auth/login) / 홈 view 실데이터 검증 / 인증 가드 redirect / **T051 재검증(SC-002)** |
| **R3 새 프로젝트** | US2 (P2) | frontend | `/projects/new` 폼(제목 필수 + 메타 5필드) / `projects.ts` create / 생성 후 `/projects/{id}` 이동 / 검증 표시 |
| **R4 메타 카드 + 편집 + lifecycle** | US3 (P3) | frontend | `/projects/[id]` 메타 카드 / `/projects/[id]/edit` 부분 수정(PATCH) / archive·unarchive·delete(확인) |
| **R5 등장인물** | US4 (P4) | frontend | `/projects/[id]/characters` 목록·생성·편집·삭제·reorder / `characters.ts` |
| **R6 회원가입 + 재설정** | US5 (P5) | frontend | signup-email / verify / reset 4단계 폼 실동작 |
| **R7 카카오** | US6 (P6) | frontend | 카카오 로그인 버튼·콜백 진입(쿠키화는 R1) / 추가 연결 / 충돌 안내 |

R1 이 모든 데이터 화면의 전제(P1 foundational). R2~R7 은 R1 위에 독립 테스트 가능.

## Project Structure

### Documentation (this feature)

```text
specs/005-phase-2-frontend-views/
├── spec.md                      # /speckit-specify + /speckit-clarify (US1~6 + FR-001~027 + SC-001~009 + Clarifications)
├── plan.md                      # 본 파일 (/speckit-plan)
├── research.md                  # Phase 0 — R-1~R-N (same-origin 프록시 / 쿠키 / 카카오 콜백 / refresh / 003 회귀 / ISSUE-003 재검증)
├── data-model.md                # Phase 1 — frontend 표시 모델 + 인증 세션 + 쿠키 토큰 구조
├── quickstart.md                # Phase 1 — 로컬 dogfooding 진입(frontend dev + backend bootRun + 프록시)
├── contracts/
│   ├── auth-cookie-contract.md  # 쿠키 인증 전환 — Set-Cookie 형식 / 필터 쿠키 read / logout / 카카오 콜백
│   ├── proxy-and-client.md      # next.config rewrites + client.ts swap + 인증 가드(/me) + API 함수 시그니처
│   └── screen-data-flow.md      # 화면 5종별 데이터 흐름(query/mutation ↔ 004 endpoint 매핑)
└── checklists/
    └── requirements.md          # /speckit-specify 산출 (전 항목 ✓)
```

### Source Code (repository root)

```text
frontend/                                        # 본 spec 의 주 변경 영역
├── next.config.ts                               # 변경 — async rewrites() 로 /api/:path* → backend 프록시 (R1)
└── src/
    ├── app/
    │   ├── page.tsx                             # 검증·완성 — 홈 실데이터 (이미 listProjects query 골격, R2)
    │   ├── projects/
    │   │   ├── new/page.tsx                     # 신설 — 새 프로젝트 폼 ('use client', R3)
    │   │   └── [id]/
    │   │       ├── page.tsx                     # 신설 — 메타 카드 (R4)
    │   │       ├── edit/page.tsx                # 신설 — 메타 편집 폼 ('use client', R4)
    │   │       └── characters/page.tsx          # 신설 — 등장인물 관리 ('use client', R5)
    │   └── auth/                                # 002 골격 — 폼 실동작 부여 (R2/R6/R7)
    ├── components/
    │   ├── auth/                                # LoginForm/SignupEmailForm/Reset*/KakaoButton — 실동작 (R2/R6/R7)
    │   └── projects/                            # 신설 — ProjectCard / MetaCard / CharacterList 등 표시 컴포넌트
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts                        # 변경 — X-User-Id 제거 + same-origin path + 401 reactive refresh (R1)
    │   │   ├── projects.ts                      # 확장 — create/get/patch/archive/unarchive/delete (R3/R4)
    │   │   ├── characters.ts                    # 신설 — list/get/create/patch/reorder/delete (R5)
    │   │   └── auth.ts                          # 신설 — login/signup/verify/reset/me/logout mutation (R1/R2/R6/R7)
    │   └── auth/
    │       └── guard.ts                         # 변경 — useAuthGuard 가 /api/auth/me 기반 인증 판단 (R1)
    ├── stores/
    │   └── authPlaceholder.ts                   # 폐기/대체 — httpOnly 쿠키라 토큰 미보관 (R1, ISSUE-015)
    └── types/
        └── api.ts                               # 확장 — Project/Character/Auth 표시 타입

backend/                                          # 인증 쿠키 전환 한정 (DB/마이그레이션 변경 없음)
├── src/main/kotlin/com/writenote/
│   ├── auth/
│   │   ├── JwtAuthenticationFilter.kt           # 변경 — 헤더 없으면 쿠키(access_token)에서 read 병존 (R1)
│   │   └── OAuth2SuccessHandler.kt              # 변경 — URL fragment → Set-Cookie + redirect (R1)
│   ├── controller/
│   │   └── AuthController.kt                    # 변경 — login/refresh/logout 응답에 Set-Cookie (R1)
│   ├── config/
│   │   └── SecurityConfig.kt                    # 검토 — csrf/cors 정책 (same-origin → 현 유지 검토, R1)
│   └── (components 또는 auth)/
│       └── AuthCookieFactory.kt                 # 신설 후보 — ResponseCookie 발급/만료 helper (R1)
└── src/test/kotlin/com/writenote/
    ├── auth/JwtAuthenticationFilterTest.kt      # 확장 — 쿠키 read 케이스 (헤더 케이스 유지)
    └── controller/AuthControllerWebTest.kt      # 확장 — Set-Cookie 응답 검증 (003 헤더 케이스 유지)
```

**Structure Decision**: Monorepo web application — **frontend 주 + backend 인증 쿠키 전환**. 이전 phase(단일 영역)와 달리 양쪽 변경. frontend 는 `.claude/rules/typescript/code-quality.md`(named export / RSC 경계 / React Query·Zustand 경계), backend 는 003/004 의 계층·패키지 구조 정합. 신규 추상화는 `AuthCookieFactory`(쿠키 발급 단일 책임) 1건 후보 + frontend `components/projects/` 표시 컴포넌트 그룹.

## Complexity Tracking

> Constitution Check 의 잠재 위반 1건 검토.

| Violation 후보 | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| same-origin 프록시(next.config rewrites) — "새 인프라 레이어" | 사용자 결정(httpOnly 쿠키) + cross-site 쿠키 제약 회피. Clarifications 2026-05-28. | localStorage(헤더 인증)는 backend 무변경이나 사용자가 보안 우선으로 쿠키 선택. cross-site 직접 호출(SameSite=None+Secure+CSRF 토큰)은 배포 환경 복잡도·CSRF 표면 증가 → 프록시로 same-origin 단순화가 rework 적음. |

본 spec 의 다른 결정은 기존 룰·002 골격·003/004 API 정합 안에서 완결. `AuthCookieFactory` 외 새 추상화 없음. 위반 0건(프록시는 정당화됨).
