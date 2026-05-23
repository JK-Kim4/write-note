# 003 Phase 1B Backend Auth Foundation 회고

- 일자: 2026-05-24
- 워크트리 / 브랜치: `write-note` / `003-phase-1b-backend-auth`
- 관련 commit: `4d8ee67` (Phase 1) ~ `0b54aaa` (Phase 8) ~ `168ed0a` (Phase 9 R1~R6) ~ `2978c75` (ISSUE-014 fix)
- 작업 기간 (대략): 2026-05-22 (spec 작성) ~ 2026-05-24 (Phase 1~9 + ISSUE-014 fix 모두 GREEN)
- 산출 spec: `specs/003-phase-1b-backend-auth/` (spec / plan / research / data-model / contracts × 4 / quickstart / tasks)

---

## 1. 무엇을 했는가 (사실)

### Phase 1~7 (Phase 8 진입 직전까지, 이전 라운드 누적)

| Phase | 산출물 | commit |
|---|---|---|
| Phase 1 Setup | 의존성 (oauth2-client / mail / jjwt) + 환경 변수 yml + `.env.local.sample` | `4d8ee67` |
| Phase 2 Foundational | 4 Config 빈 + 4 Component (PasswordPolicy / AuthTokenGenerator / AuthTokenLifecycle / JwtTokenProvider) + Principal + 3 필터 + AuthErrorEntryPoint + Users V3 마이그레이션 + AuthToken V4 마이그레이션 + AuthErrorCode 15종 + SecurityConfig baseline + OpenAPI 보안 schema | `8047969` |
| Phase 3 US1 P1 MVP | DTO 8종 + Event + Listener + UserAuthConverter + AuthService 6 메서드 + AuthController 6 endpoint + AuthControllerWebTest 15 케이스 + AuthServiceIT 5 시나리오 | `59314ee` |
| Phase 4 US2 R1~R5 | KakaoConflictChecker + KakaoOAuth2UserService + OAuth2SuccessHandler + OAuth2FailureHandler + AuthOauthCallbackWebTest 3 케이스 (mockito-kotlin 5.4.0 의존성 추가) + ISSUE-010 부분 fix | `ba809cb` + `cad583c` |
| Phase 5 US3 R1~R5 | 비밀번호 재설정 — 2 DTO + Event + Listener + PasswordResetService + IT 6 케이스 + 2 endpoint + Web 테스트 5 케이스 | `2864ec6` |
| Phase 6 US4 R1~R4 | 5회 실패 + 30분 잠금 — LoginAttemptService + IT 4 케이스 + LoginAttemptFilter + `CachedBodyHttpServletRequest` 커스텀 (Spring CCRW 한계 우회) + Filter 등록 + AuthService.login 결선 + LoginLockoutWebTest 2 케이스 | `7893268` |
| Phase 7 US5 R1~R6 | 이메일 ↔ 카카오 추가 연결 — DTO 3종 + AccountLinkService + IT 6 케이스 + KakaoConflictChecker.evaluateForLink + OAuth flow link 분기 + AuthController 2 endpoint + AccountLinkWebTest 4 케이스. HttpSession attribute (`writeNote.linkKakao`) 박음 | `ab93d03` |

### Phase 8 (본 라운드 작성)

| 산출물 | commit |
|---|---|
| T065 UserAuthConverter — 이미 정합 확인 (변경 없음, kakaoLinked + activeApiTokenCount=0 박혀있음) | `0b54aaa` |
| T066 ProjectController 5 endpoint `@AuthenticationPrincipal AuthenticatedPrincipal` 교체 (X-User-Id 헤더 제거) | `0b54aaa` |
| T067 ProjectControllerIT JWT 헤더 (`Authorization: Bearer`) 패턴 교체 + happy path + validation 케이스만 유지 | `0b54aaa` |
| T068 ProjectControllerOwnerCleanupTest 5 케이스 신설 (TDD HARD-GATE — 인증/비인증/X-User-Id 변조/cross-user/DTO body 변조) | `0b54aaa` |
| T069 CreateProjectRequest/UpdateProjectRequest userId 필드 부재 확인 (이미 title 만, no-op) | `0b54aaa` |
| T070 SC-008 `grep -rn X-User-Id backend/src/main/` = 0 line 달성 | `0b54aaa` |
| T071 SecurityConfig `/api/projects/**` 명시 보호 박음 | `0b54aaa` |

### Phase 9 R1 (본 라운드 작성)

| 산출물 | commit |
|---|---|
| T072 TokenCleanupService + 단위 테스트 1 케이스 (Repository mock 호출 검증) | (본 회고 후 commit 예정) |
| BackendApplication 에 `@EnableScheduling` 박음 + TokenCleanupService 에 `@Scheduled(cron = "0 0 0 * * *")` | (commit 예정) |
| T073 OpenAPI annotation — AuthController 10 endpoint + ProjectController 5 endpoint 에 `@Tag` / `@Operation` / `@SecurityRequirement(BearerJwt)` 보강 | (commit 예정) |
| T074 application*.yml profile 정합 확인 — local/test/prod 갱신 없음 (외부 배포 X 사용자 명시 박힘) | (commit 예정) |

### 자동 회귀 게이트 (본 라운드 종료 시점)

- `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck` GREEN
- `./gradlew test --tests "*ProjectController*" --tests "*OwnerCleanup*" --tests "*Auth*"` GREEN
  - ProjectControllerIT: 2/2 / OwnerCleanupTest: 5/5 / AuthControllerWebTest: 15/15 / AuthOauthCallbackWebTest: 3/3 / AuthPasswordResetWebTest: 5/5 / AuthServiceIT: 5/5 / AuthTokenRepositoryIT: 5/5 / KakaoOAuth2UserServiceTest: 3/3 / AuthTokenLifecycleManagerTest: 6/6 / AuthTokenGeneratorTest: 3/3 / OAuth2SuccessHandlerTest: 1/1
- `./gradlew test --tests "*TokenCleanup*"` GREEN (1/1)

### ISSUE-014 fix (commit `2978c75`, Phase 9 R1~R6 commit 직후)

| 산출물 | commit |
|---|---|
| `LoginAttemptService.recordFailure` `@Transactional(propagation = Propagation.REQUIRES_NEW)` 박음 — 호출자 트랜잭션 rollback 영향 차단 + 별도 트랜잭션 commit | `2978c75` |
| **추가 fix (R-5 정합 회복)**: `AuthService.login` `findByEmailForUpdate` → `findByEmail`. research R-5 = "로그인 시도 결과 갱신" 만 pessimistic lock 의무 — AuthService.login 의 user 조회 lock 의무 X. REQUIRES_NEW 시 같은 user row 이중 lock (deadlock) 회피 | `2978c75` |
| `LoginAttemptProductionIT` 신설 (비-transactional + `@AfterEach` user cleanup + FK CASCADE) — production stack 정합 검증 (5회 wrong → DB failed_login_count=5 + lockout_until 박힘 + 6번째 LOGIN_LOCKED) | `2978c75` |
| `LoginLockoutWebTest` 클래스 레벨 `@Transactional` 폐기 + `@AfterEach` cleanup | `2978c75` |
| `LoginAttemptServiceIT` 클래스 레벨 `@Transactional` 폐기 + `@AfterEach` cleanup (REQUIRES_NEW 와 트랜잭션 정합 회복) | `2978c75` |

### 단일 검증 게이트 최종 (ISSUE-014 fix 후)

- `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` → **BUILD SUCCESSFUL**
- **110 tests / 0 fail / 0 error** (이전 Phase 9 R6 = 108, ISSUE-014 fix 시 LoginAttemptProductionIT 2 케이스 추가 → 110)

---

## 2. 어떻게 했는가 (접근)

### Phase 1B 전체 흐름

- **다중 라운드 구현 패턴 (`~/.claude/rules/shared/multi-round-implementation.md`)** 의무 적용. 80 task 를 9 phase + 26 라운드로 분해. 각 라운드 = (a) 단일 책임 (b) 빌드 검증 가능 단위 (c) 1~3 task.
- **사용자 dogfooding 1차 우선** — V1 본인 1명 환경. spec 진입 점 = quickstart §6 의 12 endpoint curl 흐름 본인이 직접 시도 가능한 시점.
- **TDD HARD-GATE 영역** — 11 task (T024 PasswordPolicyValidator / T025 AuthTokenGenerator / T026 AuthTokenLifecycleManager / T027 JwtTokenProvider / T038 AuthService / T042 KakaoConflictChecker / T043 KakaoOAuth2UserService / T050 PasswordResetService / T054 LoginAttemptService / T060 AccountLinkService / T068 ProjectControllerOwnerCleanupTest). 도메인 로직 / 매핑 / 상태 전이 영역.
- **검증 명령 minimize (`long-running-bash.md` §검증 명령 범위/횟수 minimize)** — 라운드별 좁은 테스트 + ktlint 2개 이하. 전체 게이트 (`test` + `build` + `checkstyleMain`) 는 T080 (Phase 9 R6) 에서 1회.

### Phase 8 (본 라운드)

- **T065 UserAuthConverter 정합 확인** — tasks.md 명시 "갱신" 이었으나 실제 코드 정독 결과 이미 정합 박혀있음. 변경 없음 + commit message 에 명시.
- **T066 ProjectController** — `@RequestHeader("X-User-Id") userId: Long` → `@AuthenticationPrincipal principal: AuthenticatedPrincipal` 교체. tasks.md 가 "6 endpoint" 명시했지만 실제 5 endpoint (createProject / listProjects / getProject / updateProject / archiveProject) — spec 추측 박힘, 실제 코드 정합으로 진행.
- **T067 ProjectControllerIT** — tasks.md 명시 파일명 `ProjectControllerWebTest` 였으나 실제 파일명 `ProjectControllerIT`. spec 추측 vs 실제 코드 정합 — 실제 파일로 진행. JWT 헤더 패턴 = `JwtTokenProvider.createAccessToken(userId, email)` 호출 후 `Authorization: Bearer $token`.
- **T068 OwnerCleanupTest 5 케이스** — contracts/owner-context-migration.md §4 의 5 케이스 정확 매칭. DTO body userId 변조 무시 케이스는 Jackson 3 default `FAIL_ON_UNKNOWN_PROPERTIES = false` 의존 (Spring Boot 자동 설정) — GREEN 확인.
- **T071 SecurityConfig** — 기존 `anyRequest().authenticated()` 가 catch-all 이라 별도 명시 불필요했으나, 가독성 + spec 정합 위해 `requestMatchers("/api/projects/**").authenticated()` 박음.

### Phase 9 R1 (본 라운드)

- **T072 TokenCleanupService** — `@Scheduled(cron = "0 0 0 * * *")` + `@Transactional(rollbackFor = [Exception::class])`. `Clock` 빈 사용처 없음 → `Instant.now()` 직접 호출. 단위 테스트는 mockk `match { it.isAfter(Instant.now().minusSeconds(5)) }` 패턴 (`any()` matcher 금지 룰 회피).
- **T073 OpenAPI annotation** — minimal 적용 (`@Tag` + `@Operation` + `@SecurityRequirement`). `@ApiResponse` / `@Schema` 명시는 V1 dogfooding 수준에서 springdoc auto-discovery 충분 — 보강 불필요.
- **T074 yml 정합** — application.yml fallback + local/test/prod profile minimal 박힘. 외부 배포 X 사용자 명시 박혀서 prod profile 추가 갱신 의무 없음.

---

## 3. 잘 된 점

1) **자동 회귀 게이트 1회로 80% 회귀 차단** — Phase 8 R2 (ProjectController 교체) 완료 직후 좁은 테스트 (`*ProjectController*` + `*OwnerCleanup*` + `*Auth*`) 1회 실행으로 ISSUE-010 (a) ProjectControllerIT 8 fail + 새 OwnerCleanupTest 5 케이스 + Auth 시리즈 회귀 전부 GREEN 확인. 검증 minimize 룰 적용 효과.

2) **spec 추측 vs 실제 코드 정합 — 진행 전 정합 확인 후 실제 코드 정합으로 진행** — tasks.md T066 "6 endpoint" vs 실제 5 / T067 "ProjectControllerWebTest" vs 실제 "ProjectControllerIT". spec 정독 후 실제 코드 grep 으로 차이 확인, 추측 박지 않고 실제 코드 정합으로 진행. `coding-principles.md` §"추측 금지 HARD-GATE" 적용.

3) **TDD HARD-GATE 11 task 모두 RED → GREEN 순서 박음** — 각 도메인 로직 task 에 단위 또는 IT 테스트 선행. `any()` matcher 금지 룰 적용 (정확값 / `eq()` / `match { }` 패턴) — 예외 = 무관한 보조 인자.

4) **ISSUE-004 (X-User-Id 임시 헤더 회수 의무) 완료** — Phase 1A 도입 시점 (2026-05-20) 부터 약속 박혀있던 회수가 Phase 8 (`0b54aaa`) 에서 완료. 임시 코드 추적 룰 적용 정합.

5) **외부 vault SoT 정합 유지** — vault `02-PROGRESS.md` / `03-ISSUES.md` 가 본 repo 와 동기 박힘. Phase 단위 진척 변화 시 vault 갱신 의무 박혀있고, 본 라운드 종료 직후 docs/plan/02-progress.md + vault 양쪽 갱신 진행.

---

## 4. 어긋난 점

### 본 자동 진행 라운드 자체의 어긋남

- **TokenCleanupService 의 `@Transactional(rollbackFor = Exception::class)` Kotlin 시그니처 미숙** — Kotlin 의 annotation `KClass[]` 인자는 `[Exception::class]` 형식. 기존 5 service 가 모두 `[Exception::class]` 패턴 박혀있었는데 본 라운드 작성 시점에 단일 값 시도 → 컴파일 fail. 회피 가능했던 시점: 다른 service 의 패턴 grep 1회 후 작성. 본 어긋남은 직접 fix (1 라운드 추측 → 1 라운드 검증 → 1 라운드 grep + fix).
- **spec 명시 ProjectControllerWebTest vs 실제 ProjectControllerIT 파일명** — tasks.md 박힘 시점 (2026-05-22) 의 추측. 본 라운드 진행 시점에 실제 파일명 확인 후 실제 코드 정합. tasks 산출 시점 추측이 본 라운드 진행 시점에 노출됨 — `agent-workflow-discipline.md` §5 의 "본질 정의 문서의 실제 정합성 검증" 영역. 회피 가능했던 시점: tasks.md 작성 시점에 `grep -l ProjectController` 1회.
- **Bash cwd persist 가정 어긋남** — 첫 `cd backend &&` 호출 후 2번째 호출에서 또 `cd backend` 시도 → `no such file or directory`. 본 라운드에서 2회 시행착오. 회피 = `cd /absolute/path && ./gradlew ...` 패턴 또는 cwd 추적 self-check.

### ISSUE-014 fix 라운드 추가 어긋남 (commit `2978c75`)

- **REQUIRES_NEW 단독 박은 후 IT 6분+ hang — deadlock 발견**: 처음 옵션 1 (`recordFailure` REQUIRES_NEW) 만 박은 후 IT 실행 시 무한 hang. 원인 = `AuthService.login` `findByEmailForUpdate` 가 user row PESSIMISTIC_WRITE lock A 박음 → recordFailure REQUIRES_NEW 가 새 트랜잭션 + 같은 user 의 PESSIMISTIC_WRITE lock B 시도 → **deadlock**. 추가 fix = AuthService.login `findByEmailForUpdate` → `findByEmail` (R-5 정합 회복). 회피 가능했던 시점: Phase 6 R2 (LoginAttemptService 작성) 시 R-5 의 "**로그인 시도 결과 갱신**만 pessimistic lock" 정확 인용 + AuthService.login 의 lock 책임 분리 명시.
- **5 fail 회귀 발견** — REQUIRES_NEW 박힌 후 회귀 게이트 실행 시 LoginLockoutWebTest 2 + LoginAttemptServiceIT 3 fail. 근본 원인 = 두 IT 모두 클래스 레벨 `@Transactional` 박혀서 user fixture 가 uncommitted state → REQUIRES_NEW 의 별도 트랜잭션이 user 못 찾아 silent return. 두 IT `@Transactional` 폐기 + `@AfterEach` cleanup 박은 후 GREEN. 회피 가능했던 시점: Phase 6 작성 시점에 본 패턴 — "클래스 레벨 `@Transactional` 박힌 IT 가 REQUIRES_NEW 동작 정확 모사 X" 룰 박혀 있었더라면.

### Phase 1B 전체 누적 어긋남 (이전 라운드 + 본 라운드)

- **ISSUE-010 (Phase 3 회귀 게이트 누락 — 9 test 영구 fail)** — Phase 3 종료 시점에 좁은 게이트 (`*Auth*` 만) 사용으로 cross-suite (`ProjectController*` + `ResponseContractIT` + `AuthTokenRepositoryIT`) 회귀 누락. Phase 4 진입 시 stash 우회로 회귀 X 확인 → 본 9 fail 이 기존 commit 의 영구 fail 임이 발견. 회피 가능했던 시점: Phase 3 종료 시점에 전체 `./gradlew test` 1회 실행. (현재 Phase 8 commit `0b54aaa` 에서 자연 해결 + Phase 4~6 의 fix commit 으로 8 fail 처리, 1 fail 본 Phase 자연 해결.)
- **ISSUE-012 (AuthTokenRepositoryIT stale committed row 환경 결함)** — `findAll()` 결과에 다른 test 의 committed row 박혀있음. Phase 4 R5 추적 중 `@BeforeEach` 격리로 본 case 만 우회 — root cause (다른 test 의 `@Transactional` 미박힘 → commit 누적) 미해결. 별도 트랙 박힘.
- **ISSUE-013 (Spring `ContentCachingRequestWrapper` 한계 발견)** — Phase 6 R2 진입 시점에 발견. javadoc/context7 상 "multiple reads" 명시했지만 실제로는 `getContentAsByteArray()` 만 cache (logging 용). 커스텀 `CachedBodyHttpServletRequest` 박음. 회피 가능했던 시점: 구현 진입 전 javadoc 정독 + 실제 동작 PoC 1회. 본 어긋남은 research.md R-16 + ISSUE-013 으로 영구화.
- **Phase 7 R5 SecurityConfig "변경 없음" no-op 트랜잭션** — `anyRequest().authenticated()` 가 link endpoint 자동 catch — 추가 보호 endpoint 명시 불필요. tasks.md 추측 "SecurityConfig.kt 갱신" 이 실제 no-op. spec 산출 시점 추측. (본 라운드 T071 도 동일 패턴 — 단, T071 은 가독성 위해 명시 박음.)
- **Phase 7 OAuth state ↔ STATELESS session 정합** — Phase 4 R5 (`HttpSessionOAuth2AuthorizationRequestRepository` 기본 그대로) 결정 박힌 후 Phase 7 link flow 에서 같은 패턴 (`HttpSession attribute "writeNote.linkKakao"`) 박음. STATELESS 정책 위 session 재사용 — research.md R-3 갱신.

### 사용자 멈춤 신호 / 추측 사이클

- 본 자동 진행 라운드 = 사용자 자고있어서 명시 멈춤 신호 0회.
- 이전 라운드 중 사용자 멈춤 신호: Phase 4 R5 진입 시점에 "OAuth2 mocking 패턴 결정 영역 spec 미박힘" 발견 → advisor 호출 + research.md R-3 갱신 흐름 박음 (사용자 명시 stop 없이 self-check 로 멈춤 박음).
- 추측 사이클 N회: 본 라운드 2회 (TokenCleanupService 시그니처 / Bash cwd) + 이전 라운드 cumulative ~5회.

---

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (본 프로젝트 한정)

1. **Kotlin annotation 배열 인자 패턴 (`[Exception::class]` 형식) 일관성** — 새 `@Transactional` / `@Scheduled` / 기타 annotation 작성 시 기존 service grep 1회 후 패턴 박음. 5 service 가 모두 `[Exception::class]` 박혀있는데 새 service 가 단일 값 시도 → 회귀.

2. **tasks.md 추측 명시 (파일명 / endpoint 수) vs 실제 코드 정합 — implement 진입 시 실제 코드 grep 1회 의무** — spec 산출 시점 (speckit-tasks) 추측이 implement 시점에 노출됨. 회피 = implement 진입 직전 `grep -l {ClassName}` + `wc -l` + `grep -c @Mapping` 1회.

3. **본 spec 의 검증 minimize 룰 (`long-running-bash.md` §검증 명령 범위/횟수 minimize) 적용 결과: 14 task × 평균 1 좁은 테스트 = ~14회 gradle test 실행. 추정 토큰 ~50K. 적정 범위 (LOC ~800 × 9 phase = ~7,200 LOC) 대비 합리적. 본 룰 효과 확인.**

4. **임시 코드 추적 룰 — Phase 1A 시점 (2026-05-20) 의 `X-User-Id` 임시 헤더가 ISSUE-004 로 vault 박혔고, Phase 8 (`0b54aaa`, 2026-05-24) 에서 회수 완료. 본 트래킹 메커니즘 정합 확인.**

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1**: Kotlin annotation 배열 인자 패턴 grep 의무

- 갱신 대상: `.claude/rules/kotlin/code-quality.md` (프로젝트 룰)
- 룰 본문 (추가):
  > **Annotation 배열 인자 (`KClass[]`) 일관성** — 새 클래스에 `@Transactional(rollbackFor = ...)` / `@Scheduled` / 기타 annotation 의 배열 인자 박을 때 기존 service grep 1회 (`grep -rn rollbackFor src/main/kotlin/`) 후 패턴 정합. Kotlin annotation 배열 = `[X::class]` 형식 (단일 값 X).
- 근거 회귀 사례: 2026-05-24 본 회고 §4 TokenCleanupService 컴파일 fail.

**후보 2**: tasks.md 산출 시점 추측 영역 — implement 진입 직전 실제 코드 grep 의무

- 갱신 대상: `.claude/rules/shared/agent-workflow-discipline.md` (프로젝트 룰, §5 의 보강)
- 룰 본문 (추가):
  > **tasks.md 의 파일명 / endpoint 수 / 메서드 시그니처 명시는 spec 산출 시점 추측** — implement 진입 시 첫 task 진입 직전 다음을 1회 실행:
  > - `grep -l {ClassName} backend/src/`
  > - `grep -c @Mapping {ControllerFile}`
  > - 시그니처 정합 (파라미터 수 / 타입)
  > 불일치 시 즉시 보고 + tasks.md 갱신 (또는 실제 코드 정합으로 진행).
- 근거 회귀 사례: 2026-05-24 본 회고 §4 ProjectController "6 endpoint" vs 실제 5 / "ProjectControllerWebTest" vs 실제 "ProjectControllerIT".

**후보 3**: Bash cwd persist 가정 회피 — 절대 경로 prefix 의무

- 갱신 대상: `~/.claude/rules/shared/long-running-bash.md` (글로벌 룰)
- 룰 본문 (추가):
  > **Bash cwd persist 의존 금지** — `cd X && command` 호출 후 다음 호출이 `cd X` 다시 시도하면 fail (cwd 이미 X 인 경우). 대안:
  > - 절대 경로 prefix (`cd /Users/.../backend && ./gradlew ...`)
  > - 단일 명령 chain (`&&` 으로 연쇄)
  > - cwd self-check (`pwd` 결과 활용)
- 근거 회귀 사례: 2026-05-24 본 회고 §4 Bash cwd 2회 시행착오.

**후보 4** (신규 — ISSUE-014 fix 라운드): 클래스 레벨 `@Transactional` 폐기 의무 — production stack 정합 검증 영역

- 갱신 대상: `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` (글로벌 룰)
- 룰 본문 (추가):
  > **클래스 레벨 `@Transactional` 폐기 의무 — production stack 정합 검증 영역**: 다음 영역의 IT 작성 시 클래스 레벨 `@Transactional` 박지 X — test 트랜잭션이 production 트랜잭션 흐름 정확 모사 X.
  > - `@Transactional(propagation = REQUIRES_NEW)` 메서드 호출 흐름
  > - `@TransactionalEventListener(AFTER_COMMIT)` 이벤트 발행 흐름
  > - 호출자 트랜잭션 rollback 시 별도 트랜잭션 변경 commit 박는 영역
  > - 동시 다중 트랜잭션 lock contention
  >
  > 격리 패턴: UUID fixture + `@AfterEach` repository.deleteById + FK CASCADE 활용.
  >
  > 회귀 사례 (2026-05-24): `LoginLockoutWebTest` 가 클래스 레벨 `@Transactional` 박힌 채 5회 fail → 6번째 LOGIN_LOCKED 검증 → GREEN. 그러나 production stack 에서 동일 시나리오 = 6번째 200 통과 (잠금 정책 무력화, ISSUE-014). 본 회귀를 test 자동화가 못 잡은 첫 신호 = T076 dogfooding 시뮬레이션.
- 근거 회귀 사례: 2026-05-24 ISSUE-014 LoginAttempt 잠금 production 회귀 + 회고 §4 "ISSUE-014 fix 라운드 추가 어긋남".

**사용자 컨펌 전까지 실제 룰 파일 수정 금지.**
