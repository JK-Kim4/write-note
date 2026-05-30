# write-note V1 — 작업 진척도

**최종 갱신:** 2026-05-30
**상태:** **005 Phase 2 Frontend Views & Auth Integration — 자동화 전 task 완료 (T001~T050, T052, T053 = 49/55 + Polish 3).** MVP(US1 로그인+홈) 사용자 직접 검증 통과(SC-001/002/003/005) 후 US2~US6 전부 frontend 구현 + 양쪽 게이트 GREEN — R1 인증 httpOnly 쿠키 전환(backend+frontend, refresh·logout 쿠키 fallback 보완) / US2 새 프로젝트 / US3 메타카드·편집·생명주기 / US4 등장인물 CRUD·reorder / US5 가입·이메일인증·재설정(메일 링크 frontend 라우트 재설계) / US6 카카오(외부 인가 검증 제약). frontend 17 테스트 GREEN(vitest3+vite5+jsdom26, vault [[03-ISSUES]] ISSUE-016) / backend BUILD SUCCESSFUL(003/004 회귀 GREEN). US별 단위 커밋 6종(`6161184` R1 backend → `496745c` Polish). **남은 것:** T051(신규 화면 다크모드 직접점검) / T054(quickstart 전체 직접점검) — 사용자 브라우저 영역 + T055 문서 갱신(본 작업). 004 Phase 2 Backend ✅ 종료(`8090547`) / 002 frontend dogfooding ✅ 종료(4건 통과).
**SoT 진입점:** **`specs/005-phase-2-frontend-views/HANDOFF.md`** (브랜치 내 작업 인수문서 — 현재 상태 + 남은 작업 상세 + 다음 세션 첫 프롬프트 + 환경 메모 + 미커밋 변경 목록). 추가 정독: [005 spec.md](../../specs/005-phase-2-frontend-views/spec.md) Clarifications(same-origin 프록시) + [tasks.md](../../specs/005-phase-2-frontend-views/tasks.md) [X 마킹] + 외부 vault [[02-PROGRESS]] §2 / [[03-ISSUES]] ISSUE-015 ✅(코드·테스트 해소 — 쿠키 전환 + X-User-Id 폐기, 최종 dogfooding T054 잔존) · ISSUE-016 ✅

---

## 0. 본 문서의 위치

```
[1] DESIGN.md                    ← 본질 + UI/UX 결정 (변경 빈도 낮음)
[2] 00-stack-and-schedule.md     ← 기술 스택 + Week 일정 + 보류 결정
[3] 01-phase-breakdown.md        ← Week → Phase 56개 분해
[4] 본 문서 (02-progress)        ← Phase 진척도 + 본 세션 결과 누적 (다음 세션 컨텍스트)
[5] week-N/phase-M.md            ← 각 Phase 진입 시 상세 spec
```

write-note 의 본질 (컨텍스트 영속) 을 본 도구 만드는 과정에도 적용. 다음 세션 진입 시 본 문서 + [3] + 직전 Phase spec 만 읽으면 재진입 가능.

---

## 1. 완료된 작업 (Phase 단위)

### 모노레포 셋업 (2026-05-19, Phase 0 진입 전)

| Phase | 상태 | 산출물 / 커밋 |
|---|---|---|
| 디렉토리 분리 + 빌드 도구 분리 | ✅ | `frontend/` (Next.js 16) + `backend/` (Spring Boot 4.0.6) + 루트 `docker-compose.yml` + `docs/plan/` 갱신. commits: `2dcc183` (frontend) / `c2668b8` (backend) / `e808d36` (docker + README). Merge: `4e98691` |

**핵심 결정** (`docs/plan/00-stack §2-1` 갱신):
- Spring Boot 3.x → **4.0.6** (start.spring.io current GA)
- Next.js 15 → **16.2.6** (`pnpm dlx create-next-app@latest` 결과)
- Java 25 → **24 toolchain** (PoC 0-2 회귀 — Kotlin 2.2.21 의 JVM target 25 미지원)
- 시스템 Java = Corretto 25 호스트 (Gradle 이 toolchain 24 처리)
- 모노레포 = **단순 디렉토리 분리** (pnpm workspaces / Turborepo 안 씀)
- 로컬 docker = **postgres:17-alpine 만** (BE 는 호스트 `./gradlew bootRun`, FE 는 호스트 `pnpm dev`)
- 브랜치 = **정통 git flow + 옵션 B** (main 변경 0, 모든 산출물은 develop)

### Phase 0 PoC 3종 (2026-05-19, 모두 ✅ 통과)

| Phase | 상태 | 통과 보고 | 커밋 |
|---|---|---|---|
| 0-1 TipTap 한국어 IME | ✅ | [`docs/poc/0-1-tiptap-korean.md`](../poc/0-1-tiptap-korean.md) | `649b007` → merge `d09c460` |
| 0-2 Spring Boot + Postgres | ✅ | [`docs/poc/0-2-spring-postgres.md`](../poc/0-2-spring-postgres.md) | `6f2c451` → merge `14e47e5` |
| 0-3 PWA manifest + SW | ✅ | [`docs/poc/0-3-pwa.md`](../poc/0-3-pwa.md) | `1f5ded8` → merge `8a840bb` |

### Phase 1A Backend Foundation (2026-05-20, 완료)

| Phase | 상태 | 산출물 |
|---|---|---|
| 1A Backend Foundation | ✅ | PoC `Ping` 제거, Gradle 품질 게이트(ktlint/Checkstyle), profile 기반 YAML, `users`/`projects` Flyway migration, `User`/`Project` JPA entity+repository, 표준 `Result<T>` envelope와 전역 예외 처리, `/api/projects` ownership-scoped CRUD |

**검증 명령:**

```bash
cd backend
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

결과: `BUILD SUCCESSFUL` (2026-05-20). 로컬 PostgreSQL은 `docker compose up -d --wait postgres`로 기동.

**중요한 구현 결정:**
- Phase 1A Project CRUD는 임시 `X-User-Id` header로 owner context를 받는다.
- Week 1B에서 `X-User-Id`를 authenticated principal user id로 교체해야 하며, 클라이언트가 owner id를 직접 제어하지 못하게 해야 한다.
- Project CRUD는 최소 필드(`id`, `userId`, `title`, `archived`, `createdAt`, `updatedAt`)만 구현했다. genre/target length/tone/synopsis/world notes는 Week 2 범위.

### 002 Frontend Route & Page Scaffold (2026-05-21~28, ✅ 종료 — 자동화 GREEN + develop merge `6eee578` + dogfooding 4건 통과)

| Phase | 상태 | 산출물 |
|---|---|---|
| 002 Frontend Route & Page Scaffold | ✅ 종료 (4건 dogfooding 통과 / T051 → ISSUE-015 005 이연) | wireframe 전체 (12 인증 + 6 메인 view + H0) 라우트 골격 + 공유 인프라 (디자인 토큰 / 다크 모드 / React Query / Zustand / fetch 기반 API client + 임시 X-User-Id) + PoC 검증용 `/poc/*` 폐기 + production PWA manifest+sw-register 유지 |

**spec/plan/tasks:** [`specs/002-frontend-route-scaffold/`](../../specs/002-frontend-route-scaffold/) (spec.md / plan.md / research.md / data-model.md / contracts/route-surfaces.md / contracts/api-client.md / quickstart.md / tasks.md / checklists/requirements.md)

**핵심 결정 (Clarification 2026-05-20):**
- Q1 PoC 검증용 page (`/poc/tiptap`, `/poc/pwa`) 폐기. production manifest/sw-register 유지
- Q2 인증 = nested route + shared layout (`/auth/<panel>` 12 자식 + `auth/layout.tsx`)
- Q3 작성 = `/write` 단일 URL + `/write/preview` 자식 route, 모드 분기는 설정에서
- Q4 H0 = `/` 홈 라우트의 동적 변형 (프로젝트 0 ↔ 1+)
- Q5 1:1 시각 측정 = 디자인 토큰 grep + 컴포넌트 매핑 표 + 라이트/다크 육안 비교 (visual regression 자동화 보류)

**자동화 검증 결과 (T052/T055/T056):**
- 디자인 토큰 grep — `#0066cc / #2997ff / #d70015 / #ff453a / 14px / 16px / 18px / 0.95 / #28231d` 모두 `tokens.css` / `globals.css` 에 박힘 ✓
- 가드 적용 — `requireAnon`: `auth/layout.tsx` / `requireAuth`: `page.tsx`, `memos/page.tsx`, `settings/page.tsx`, `write/layout.tsx` ✓
- `pnpm lint` + `pnpm build` GREEN — 21 static page 생성 (19 surface + manifest + auto not-found) ✓

**사용자 dogfooding 결과 (2026-05-28, ✅ 4건 통과 / T051 → ISSUE-015 005 이연):**
- T049 다크 모드 19 surface 일관 (라이트↔다크 토글 + surface 간 이동 시 선호 유지) — ✅ 통과
- T050 시스템 테마 따라가기 (`theme === 'system'` + OS 변경) — ✅ 통과
- T051 placeholder query 동작 (backend `bootRun` + `useProjects` 호출 + envelope unwrap) — ⏭️ 005 이연 (frontend `X-User-Id` ↔ backend JWT drift, 실측 `401 AUTH_TOKEN_MISSING`. ISSUE-015)
- T053 19 surface 1:1 시각 비교 (`pnpm dev` + `designs/wireframe.html` 옆 비교) — ✅ 통과
- T054 PWA "홈 화면 추가" (iOS Safari + Android Chrome) — ✅ 통과

**중요한 구현 결정:**
- Next.js 16 Server → Client component 로 `onSubmit` 핸들러 직접 전달 불가 발견 → form 컴포넌트 4 종에 `'use client'` 추가
- `frontend/AGENTS.md` 의 경고 (`node_modules/next/dist/docs/` 정독 의무) 의 docs 디렉토리가 실제 install 에 없음 — 별도 트랙 정리 필요
- Noto Serif KR / Nanum Myeongjo `next/font/google` 메타데이터가 `subsets: ['latin']` 만 명시 지원 — 폰트 파일 자체의 한국어 글리프 의존, dogfooding 시점 검증

### 003 Phase 1B Backend Auth (2026-05-23 ~ 진행 중)

**브랜치:** `003-phase-1b-backend-auth` (develop 분기, origin 동기)
**spec/plan/tasks:** [`specs/003-phase-1b-backend-auth/`](../../specs/003-phase-1b-backend-auth/) (spec.md / plan.md / research.md / data-model.md / contracts/auth-endpoints.md / contracts/security-filter-chain.md / contracts/token-formats.md / contracts/owner-context-migration.md / quickstart.md / tasks.md)

| Phase | 영역 | 커밋 |
|---|---|---|
| Phase 1 Setup | 의존성 + 환경 변수 yml + `.env` sample (T001~T005) | `4d8ee67` |
| Phase 2 Foundational | Config 빈 / 에러 코드 / Users V3 마이그레이션 / AuthToken V4 / Component / Principal·필터·SecurityConfig baseline / OpenAPI 보안 schema (T006~T032, R-A~R-G) | `8047969` |
| Phase 3 US1 P1 MVP | DTO + 이벤트 / Converter / Service (TDD) / Controller + Security 갱신 / Web 테스트 — 이메일·비밀번호 회원가입 + 로그인 + JWT refresh + 본인 정보 조회 (T033~T041) | `59314ee` |
| 메타 | CLAUDE.md 에 외부 vault SoT 섹션 추가 | `ee9c46a` |
| Phase 4 US2 R1~R4 | KakaoConflictChecker (T042) + KakaoOAuth2UserService (T043) + OAuth2SuccessHandler (T044) + SecurityConfig oauth2Login 결선 + OAuth2FailureHandler (T045) | `ba809cb` |
| Phase 4 US2 R5 + 회귀 정리 | T046 AuthOauthCallbackWebTest 3 케이스 + ISSUE-010 부분 fix (AuthTokenRepositoryIT cleanup JPQL named-param + ResponseContractIT addFilters=false) + mockito-kotlin 5.4.0 의존성 + research.md R-3 갱신 | `cad583c` |
| Phase 5 US3 R1~R5 | 비밀번호 재설정 — 2 DTO + Event + Listener + PasswordResetService + IT 6 케이스 (TDD HARD-GATE) + AuthController 2 endpoint + AuthPasswordResetWebTest 5 케이스 (T047~T053) | `2864ec6` |
| Phase 6 US4 R1~R4 | 5회 실패 + 30분 잠금 — LoginAttemptService + IT 4 케이스 (TDD HARD-GATE) + LoginAttemptFilter + CachedBodyHttpServletRequest + SecurityConfig + AuthService.login 결선 + LoginLockoutWebTest 2 케이스 (T054~T058). 의외 결정: Spring `ContentCachingRequestWrapper` 한계 발견 → 커스텀 wrapper (research.md R-16) | `7893268` |
| Phase 7 US5 R1~R6 | 이메일 ↔ 카카오 추가 연결 — DTO 3종 (LinkEmailRequest / LinkKakaoStateRequest session wrapper / LinkEmailResponse) + AccountLinkService + IT 6 케이스 (TDD HARD-GATE) + KakaoConflictChecker.evaluateForLink + KakaoOAuth2UserService link flow 분기 + OAuth2SuccessHandler link flow 분기 + AuthController 2 endpoint + AccountLinkWebTest 4 케이스 (T059~T064). 본질 결정: HttpSession attribute (`writeNote.linkKakao`) 박음 — STATELESS 정책 위에 OAuth state 보관용 session 재사용 | `ab93d03` |
| Phase 8 US6 R1~R4 | US6 본인 정보 조회 + X-User-Id 임시 헤더 정리 — T065 UserAuthConverter 이미 정합 확인 (변경 없음, kakaoLinked + activeApiTokenCount=0) + T066 ProjectController 5 endpoint `@AuthenticationPrincipal AuthenticatedPrincipal` 교체 + T067 ProjectControllerIT JWT 헤더 (`Authorization: Bearer`) 패턴 교체 + T068 ProjectControllerOwnerCleanupTest 5 케이스 신설 (TDD HARD-GATE: 인증 200 / 비인증 401 AUTH_TOKEN_MISSING / X-User-Id 변조 무시 / cross-user 404 / DTO body userId 변조 무시) + T069 DTO userId 필드 부재 확인 (Create/UpdateProjectRequest 이미 title 만) + T070 SC-008 `grep -rn X-User-Id backend/src/main/` = 0 line 달성 + T071 SecurityConfig `/api/projects/**` 명시 보호 박음. **ISSUE-010 (a) 자연 해결** | `0b54aaa` |
| Phase 9 R1~R6 Polish | T072 TokenCleanupService + 단위 테스트 + `@Scheduled(cron = "0 0 0 * * *")` 매일 자정 + `@EnableScheduling` + T073 OpenAPI annotation (`@Tag` / `@Operation` / `@SecurityRequirement(BearerJwt)`) AuthController 10 endpoint + ProjectController 5 endpoint + T074 yml 정합 확인 (외부 배포 X 사용자 명시, 변경 없음) + T077 본 docs 갱신 + T078 03-backend §6 skip (의외 결정 §1~§5 변경 없음) + T079 5축 회고 + T075 V3+V4 마이그레이션 적용 검증 (`\d users` / `\d auth_tokens` 정합) + T076 dogfooding 시뮬레이션 (6-1 GREEN, 6-2 FAIL → ISSUE-014 발견) + T080 단일 검증 게이트 108/0/0 BUILD SUCCESSFUL. **단 ISSUE-014 LoginAttempt production 회귀 별도 트랙 surfacing** | `168ed0a` |
| ISSUE-014 fix | LoginAttempt 잠금 production 회귀 fix — `LoginAttemptService.recordFailure` `@Transactional(propagation = Propagation.REQUIRES_NEW)` 박음 + **추가 fix (R-5 정합 회복)**: `AuthService.login` `findByEmailForUpdate` → `findByEmail` (lock 책임 recordFailure 단독, REQUIRES_NEW 시 같은 user row 이중 lock deadlock 회피) + `LoginAttemptProductionIT` 신설 (비-transactional + `@AfterEach` cleanup, production stack 정합) + `LoginLockoutWebTest` + `LoginAttemptServiceIT` 클래스 레벨 `@Transactional` 폐기 + `@AfterEach` cleanup. T080 110/0/0 BUILD SUCCESSFUL | `2978c75` |

**진척 합산:** 80 task 중 80 완료 (100%) + ISSUE-014 fix. 본 spec 자동화 + production stack 정합 모두 GREEN.

### 004 Phase 2 Backend Project Metadata & Character (2026-05-25 ~ 2026-05-27, ✅ 종료)

**spec/plan/tasks:** [`specs/004-phase-2-backend-project-character/`](../../specs/004-phase-2-backend-project-character/)
**브랜치:** (모두 develop merge 후 삭제 — 004-phase-5 / -6 / -7 / -8)

| Phase | 영역 | Merge |
|---|---|---|
| Phase 1+2+3+4 MVP | Project 메타 5 필드 + Character/Document entity + lifecycle (T001~T033, 33 task) | `527ce5c` |
| Phase 5 US3 | Document auto-provisioning (T034~T037, 4 task) — failure rollback IT 분리 패턴 (ISSUE-014 정합 비-transactional) + Postgres JSONB normalize 발견 (JsonMapper parse) | `17c215d` |
| Phase 6 US4 | Character CRUD 5 endpoint (T038~T044, 7 task) — ownership = ProjectService.requireOwnedProject 재사용 + entity-level delete | `1992624` |
| Phase 7 US5 | Character reorder + ValidationException 신설 (T045~T051, 7 task) — CharacterReorderValidator 4 검증 + 400 VALIDATION_FAILED 매핑 (contracts #24 정합) | `6a24439` |
| Phase 8 Polish | Cascade IT (T052) + N+1 Hibernate Statistics (T053+T054) + OpenAPI @ApiResponse 13 endpoint (T055+T056) + docs 갱신 (T057+T058+T059) + 회고 (T060) + 단일 검증 게이트 (T061) | `8090547` (+ docs `4261671`) |

**진척:** 61/62 task (T062 사용자 dogfooding 영역 분리). 본 spec scope 종료.

**다음 진입 = 005 Phase 2 Frontend Views** (홈 view / 새 프로젝트 흐름 / 메타 카드 UI / 등장인물 페이지 — `01-phase-breakdown.md §5 Phase 2-4~2-7`)

### 회고 / 룰 (본 세션 누적)

- PoC 0-2 5축 회고 — [`docs/retrospectives/2026-05-19-poc-0-2-spring-postgres.md`](../retrospectives/2026-05-19-poc-0-2-spring-postgres.md). commit `586bdba`
- 글로벌 룰 신규 — `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` (JPA 1차 캐시 우회 의무 패턴 + Testcontainers vs docker-compose 가이드)

---

## 2. 현재 git 상태

| 항목 | 값 |
|---|---|
| `main` | `53810cd` (변경 0 — 옵션 B 원칙) |
| `develop` | `4261671` (004 Phase 5/6/7/8 merge + docs 종료 박힘. origin 동기 — ahead/behind 0/0) |
| 현재 브랜치 | `develop` (004 작업 종료 후 복귀) |
| 원격 | `origin/main`, `origin/develop` push 완료 (동기). 002 는 develop merge 완료 (`6eee578`), `002-frontend-route-scaffold` (`bafbb08`) 브랜치는 미삭제 잔존 (dogfooding 4건 대기). 004 feature 브랜치 4종 (-5/-6/-7/-8) merge 후 삭제 |
| 워크트리 | 메인 1개 |
| 활성 feature 브랜치 | (없음 — 004 종료 + 브랜치 삭제. 002 는 dogfooding 대기 별도 트랙) |

### 004 Phase 2 Backend Project Metadata & Character 마무리 (2026-05-27 ~ 2026-05-28)

- 본 spec 산출물 develop 동기 — Phase 5 `17c215d` / Phase 6 `1992624` / Phase 7 `6a24439` / Phase 8 `8090547` + docs 종료 `4261671`
- 004 feature 브랜치 4종 (-5/-6/-7/-8) 모두 develop merge 후 삭제 (로컬 잔존 0 확인)
- 61/62 task 완료 (T062 dogfooding 사용자 영역 분리). T061 단일 검증 게이트 GREEN

### 003 Phase 1B Backend Auth 마무리 (2026-05-24)

- 본 spec 모든 산출물 develop 동기 (`052ae33` 1차 머지 16 commits + `eb06b55` 2차 머지 1 commit)
- 로컬 + 원격 `003-phase-1b-backend-auth` 브랜치 둘 다 삭제
- ISSUE-014 fix (`2978c75`) 박힘 + T080 단일 검증 게이트 110/0/0 BUILD SUCCESSFUL
- 회고 §5-2 룰 갱신 후보 4건 컨펌 후 적용 (`d092c2e` — 본 repo 2 / 글로벌 2)

### 본 세션 develop commit history (시간 순)

```
8a840bb Merge feature/poc-pwa into develop
1f5ded8 feat: PoC 0-3 통과 — PWA manifest + Service Worker
d09c460 Merge feature/poc-tiptap-korean into develop
649b007 feat: PoC 0-1 통과 — TipTap 한국어 IME
586bdba docs: PoC 0-2 회고
14e47e5 Merge feature/poc-spring-postgres into develop
6f2c451 feat: PoC 0-2 통과 — Spring Boot + Postgres + Java 25→24 회귀
461c472 docs: Next.js 15 → 16.2.6 명시
2dcc183 feat: frontend Next.js 16 스켈레톤
c2668b8 feat: backend Spring Boot 4.0.6 스켈레톤
e808d36 chore: docker-compose + README
4e98691 Merge feature/setup-monorepo into develop
7b34498 docs: Spring Boot 3.x → 4.0.6 + Java 25
```

---

## 3. 다음 진입점 — 005 자동화 완료 / dogfooding(T051·T054) + 문서 갱신 잔존

`/speckit-{specify,clarify,plan,tasks,implement}` 까지 진입 (2026-05-28~30). **사용자 합의 (2026-05-29) = MVP 단위 (R1 인증 쿠키 전환 + US1 로그인+홈) 진행 → 검증 후 US2~US6 결정**. 본 spec 은 frontend + backend 혼합 phase (이전 phase 와 다름) — 인증 전체 동작 + httpOnly 쿠키(same-origin 프록시) + 별도 페이지.

| 영역 | 상태 |
|---|---|
| **Setup (T001~T004)** | ✅ frontend 테스트 인프라 신설 — `vitest 3.2.4 + vite 5.4.21 + @vitejs/plugin-react 4.7.0 + @testing-library/{react,jest-dom,user-event} + msw 2.14 + jsdom 29`. Node v20.10 제약으로 vitest 4 / vite 7 비호환 정정 (vault [[03-ISSUES]] ISSUE-016 — 회고 후보). `frontend/vitest.config.ts` + `src/test/setup.ts` + `src/test/msw/server.ts` + `package.json` scripts (`test`/`typecheck`) |
| **R1 backend 코어 (T005~T009, T011, T012)** | ✅ `AuthCookieFactory` 신설 (Spring `ResponseCookie`, SameSite=Lax+HttpOnly+Path=/+Secure(env)+Max-Age) / `JwtAuthenticationFilter` 쿠키 read 병존 (헤더 `Bearer eyJ` 우선, 부재 시 `access_token` 쿠키 — **003 헤더 회귀 보존**) / `JwtAuthenticationFilterTest` 신규 5케이스 / `AuthController` login·refresh Set-Cookie + logout 만료 (body `TokenPairResponse` 유지) / `OAuth2SuccessHandler` URL fragment → Set-Cookie + 홈 redirect / `OAuth2SuccessHandlerTest` 쿠키 케이스 갱신 / `SecurityConfig` csrf disable 유지 확인 / `application.yml` `app.cookie.secure` env. **신규 단위 3종 10케이스 GREEN** |
| **남은 R1 backend** | ✅ T010 `AuthControllerWebTest` 쿠키 케이스 + T013 backend 전체 게이트 (`ktlint* + checkstyleMain + test + build`) BUILD SUCCESSFUL — 003/004 회귀 GREEN. 이후 refresh·logout 쿠키 fallback 보완(httpOnly 라 JS 가 refresh token 을 body 에 못 넣음 발견) |
| **R1 frontend (T014~T021)** | ✅ `next.config.ts` rewrites (`/api/:path*` → backend) + `client.ts` swap (X-User-Id 제거 + same-origin + `credentials:'include'` + 401 reactive refresh) + `authPlaceholder` 폐기 + `lib/api/auth.ts` 신설 + `useAuthGuard` /me 기반 전환 + types/api 확장 + frontend 게이트 GREEN |
| **US1 MVP (T022~T026)** | ✅ `LoginForm` 실동작 + 홈 `page.tsx` 실데이터(에러/빈 상태 분리) + 가드 redirect + **T051 재검증** GREEN(이전 401 해소, SC-002). **MVP 사용자 직접 검증 통과(SC-001/002/003/005)** |
| **US2~US6 + Polish (T027~T053)** | ✅ 전부 frontend 구현 + 양쪽 게이트 GREEN — US2 새 프로젝트 / US3 메타카드·편집·생명주기 / US4 등장인물 CRUD·reorder / US5 가입·이메일인증·재설정(메일 링크 frontend 라우트 재설계) / US6 카카오(외부 인가 제약) / Polish(에러 code 한국어 매핑 공통화, SC-008 grep=0). frontend 17 테스트 GREEN |
| **잔존 (사용자 브라우저 영역)** | 🔲 T051 신규 화면 5종 라이트/다크 + T054 quickstart §3 전체 dogfooding (카카오는 외부 인가 제약). 메일 링크 변경 반영 위해 점검 전 backend 재시작 필요 |
| **다음 세션 진입점** | **[`specs/005-phase-2-frontend-views/HANDOFF.md`](../../specs/005-phase-2-frontend-views/HANDOFF.md)** — 브랜치 내 작업 인수문서. §0 에 다음 세션 첫 프롬프트 박힘 |
| (보조) 004 T062 사용자 dogfooding | 🟡 사용자 영역, 미완 — `specs/004-phase-2-backend-project-character/quickstart.md §3-1~§3-9` curl 9건 |
| (V1 후속) Week 3 본문 입력 / Week 4 메모 / Week 5 세션노트 | 🟡 005 종료 후 — `01-phase-breakdown.md` Week 3~5 |

**핵심 결정 (Clarifications 2026-05-28~29):** 인증 전체 동작 + httpOnly 쿠키 + **same-origin 프록시** (Vercel/Next rewrites 로 `/api` 프록시 → SameSite=Lax + CORS 불필요 + CSRF 완화) + 별도 페이지 (`/projects/new` + 메타 편집 전용). DB 변경 0 (쿠키는 토큰 전달 매체만).

### 002 dogfooding 트랙 (✅ 완료 — vault ISSUE-001)

| Task | 작업 | 결과 |
|---|---|---|
| T049 | 다크 모드 19 surface 일관 검증 | ✅ 통과 (2026-05-28) |
| T050 | 시스템 테마 따라가기 | ✅ 통과 (2026-05-28) |
| T051 | placeholder query 동작 | ⏭️ 005 이연 — frontend `X-User-Id` ↔ backend JWT drift (실측 `401 AUTH_TOKEN_MISSING`). vault ISSUE-015 |
| T053 | 19 surface 1:1 시각 비교 | ✅ 통과 (2026-05-28) |
| T054 | PWA 홈 화면 추가 | ✅ 통과 (2026-05-28) |

4건 사용자 dogfooding 통과로 트랙 종료. T051 은 005 Frontend Views 의 frontend↔backend 인증 통합에서 재검증.

<details>
<summary>완료된 Phase 1A 진입점 기록</summary>

## 이전 진입점 — Phase 1A (Spring Boot 본격 스캐폴드)

`01-phase §3 Week 1A` 인용:

| Phase | 작업 | 출처 |
|---|---|---|
| **1A-1** | Gradle Kotlin DSL + 의존성 (Spring Web/Security/Data JPA/Validation, springdoc, ktlint) | 글로벌 룰 |
| 1A-2 | `application.yml` + 프로파일(local/prod) + DataSource (Supabase Postgres) | 글로벌 룰 |
| 1A-3 | Flyway 마이그레이션 셋업 + Users Entity 첫 스키마 | 00-stack §4-1 |
| 1A-4 | 글로벌 예외 처리 + `Result<T>` 응답 형식 + CORS 설정 | 글로벌 룰 `api-contract.md` |
| 1A-5 | Project Entity 단순 버전 CRUD end-to-end (Controller + Service + Repository) — 패턴 검증용 | 글로벌 룰 |

### 1A-1 진입 시 즉시 작업

PoC 0-2 산출물 (Ping skeleton) 의 폐기 시점이 본 Phase. 다음 작업:

1. `backend/build.gradle.kts` 에 의존성 추가:
   - `org.springframework.boot:spring-boot-starter-actuator` — health check
   - `org.springdoc:springdoc-openapi-starter-webmvc-ui:<latest>` — API 문서 (`00-stack §2-1` 박힘)
   - ktlint plugin (`org.jlleitschuh.gradle.ktlint`) — 글로벌 룰 `kotlin/code-quality.md` 박힘
   - Checkstyle plugin — 글로벌 룰 (line 120 / no wildcard import)
2. PoC 산출물 폐기 (`docs/poc/0-2-spring-postgres.md §6` 명시):
   - `backend/src/main/kotlin/com/writenote/poc/` 전체 디렉토리
   - `backend/src/main/resources/db/migration/V1__create_ping.sql` → `V1__create_users.sql` 로 swap
   - `backend/src/test/kotlin/com/writenote/poc/PingRepositoryIT.kt`

### 1A-3 진입 시 즉시 작업

Users Entity 첫 스키마 — `00-stack §4-1` 인용:

```
Users
  id, email, kakao_id (nullable), created_at, password_hash (nullable, 이메일 로그인용)
```

본 entity 의 본격 셋업이 Week 1B (인증) 의 전제. `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` (본 세션 신설) 의 1차 캐시 우회 패턴 적용 의무.

</details>

---

## 4. 보류 트랙 (사용자 결정 영역)

보류 트랙은 외부 vault [[03-ISSUES]] 로 surfacing. 본 표는 본 repo 내 요약.

| 트랙 | vault entry | 우선순위 |
|---|---|---|
| 002 dogfooding — 4건 통과 ✅ / T051 → ISSUE-015 (005 SC-002 재검증) | ISSUE-001 ✅ | 완료 (2026-05-28) |
| frontend `X-User-Id` ↔ backend JWT 인증 drift — 005 쿠키 전환으로 해소 (client.ts swap + X-User-Id 폐기 grep=0, T026 재검증 GREEN) | ISSUE-015 ✅ | 코드·테스트 해소 / 최종 dogfooding T054 잔존 |
| **vitest 4 / vite 7 — Node v20.10 비호환 (Setup 정정, 회고 후보)** | **ISSUE-016 ✅** | **완료 (2026-05-29)** |
| 003 Phase 4~9 — 003 종료로 완료 (`eb06b55` merge + ISSUE-014 fix) | ISSUE-002 ✅ | 완료 |
| `frontend/AGENTS.md` 의 docs 정독 경고 — 디렉토리 부재 → 005 plan R-10 재검증 결과 존재 확인 (정합성 회복) | ISSUE-003 ✅ | 완료 (2026-05-28) |
| 임시 `X-User-Id` 헤더 — Phase 8 에서 회수 완료 (`0b54aaa`) | ISSUE-004 ✅ | 완료 |
| Kotlin 2.3.x 의 Java 25 JVM target 지원 검증 | ISSUE-005 | V2 후보 |
| main 워크트리 untracked 정리 (`.claude/`, `.specify/`, `CLAUDE.md`) | ISSUE-006 | 별도 트랙 |
| Phase 0 전체 회고 미수행 | ISSUE-007 | 별도 트랙 |
| 본 세션 전체 통합 회고 (BE Supabase / gh / Spring Initializr / Next.js 16) | ISSUE-008 | 별도 트랙 |
| 본 vault ↔ 본 repo 02-progress 동기 정책 | ISSUE-009 | 별도 트랙 |
| 003 Phase 3 회귀 게이트 누락 — 9 test 영구 fail (2 fix Phase 4 / 1 자연 해결 Phase 8 `0b54aaa`) | ISSUE-010 ✅ | 완료 |
| AuthTokenRepositoryIT stale committed row 환경 결함 | ISSUE-012 | 별도 트랙 |
| Spring `ContentCachingRequestWrapper` 한계 — 커스텀 wrapper 박음 | ISSUE-013 | 완료 (참고용) |

---

## 5. 환경 알림 (다음 세션 진입 시 점검)

### gh CLI 활성 계정

본 세션에서 `gh auth switch --user JK-Kim4` 로 변경. 회사 계정 (`zimssa-jwkim`) 작업 시:

```bash
gh auth switch --user zimssa-jwkim
```

본 프로젝트 작업 시 다시:

```bash
gh auth switch --user JK-Kim4
```

### docker postgres

Phase 1A 구현 중 컨테이너 (`write-note-postgres`) 를 기동했고 볼륨은 `write-note_postgres-data`를 사용한다. 다음 세션 진입 시:

```bash
# develop 워크트리에서
docker compose up -d --wait postgres
```

**주의**: docker compose project name 이 워크트리 디렉토리명 기반이라 새 워크트리 (예: `phase-1a-1`) 에서 띄우면 새 볼륨 생성 → 이전 데이터 없음. Phase 1A-3 (Flyway + Users) 진입 시 spec 에 project name 명시 또는 `--project-name write-note` 옵션 사용 검토.

### 본 세션의 핵심 본질 결정 (다음 세션이 잊지 말 것)

- **BE = Kotlin + Spring Boot 4.0.6 on Java 24 toolchain** (시스템 Corretto 25 호스트). Kotlin 2.2.21 JVM target 25 미지원으로 24 회귀 — 박힌 본질
- **FE = Next.js 16.2.6 + React 19.2 + Tailwind 4.3 + TypeScript 5.9** + `@tiptap/react@3.23.5`
- **DB = PostgreSQL 17** (로컬 docker, 프로덕션 Supabase Postgres)
- **모노레포 = 단순 디렉토리 분리** — `frontend/` + `backend/` + 루트 docker-compose
- **로컬 docker = postgres 만** — BE/FE 는 호스트 직접 실행 (a/a 조합)
- **브랜치 = 정통 git flow + 옵션 B** (main 변경 0)
- **gh active = JK-Kim4** (회사 작업 시 zimssa-jwkim 으로 복귀 필요)
- **AGENTS.md (frontend) 가 "Next.js 16 breaking changes" 경고** — frontend 작업 시 `node_modules/next/dist/docs/` 사전 정독 의무

---

## 6. 본 문서 갱신 정책

- Phase 완료 시 (또는 세션 종료 시) 본 문서 갱신
- §1 완료 작업에 Phase 추가 + commit hash 박음
- §3 다음 진입점 갱신 (현재 Phase 가 완료되면 다음 Phase 로)
- §4 보류 트랙은 결정/진행 시 §1 또는 §3 으로 이동
- §5 환경 알림은 다음 세션 점검 의무 영역만 유지
