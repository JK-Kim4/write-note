# write-note V1 — 작업 진척도

**최종 갱신:** 2026-05-19
**상태:** Phase 0 완료 — Phase 1A 진입 대기
**SoT 진입점:** 다음 세션 진입 시 본 문서 + [00-stack-and-schedule.md](./00-stack-and-schedule.md) + [01-phase-breakdown.md](./01-phase-breakdown.md) 정독으로 컨텍스트 복원

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

### 회고 / 룰 (본 세션 누적)

- PoC 0-2 5축 회고 — [`docs/retrospectives/2026-05-19-poc-0-2-spring-postgres.md`](../retrospectives/2026-05-19-poc-0-2-spring-postgres.md). commit `586bdba`
- 글로벌 룰 신규 — `~/.claude/rules/kotlin/spring/jpa-test-patterns.md` (JPA 1차 캐시 우회 의무 패턴 + Testcontainers vs docker-compose 가이드)

---

## 2. 현재 git 상태

| 항목 | 값 |
|---|---|
| `main` | `53810cd` (변경 0 — 옵션 B 원칙) |
| `develop` | `<이 progress 문서 commit hash — 본 파일 commit 후 갱신>` (이전: `8a840bb`) |
| 원격 | `origin/main`, `origin/develop` 둘 다 push 완료 |
| 워크트리 | 메인 1개 |
| feature 브랜치 | 모두 정리됨 |

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

## 3. 다음 진입점 — Phase 1A (Spring Boot 본격 스캐폴드)

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

---

## 4. 보류 트랙 (사용자 결정 영역)

| 트랙 | 상태 | 결정 시점 |
|---|---|---|
| **main 워크트리 untracked 정리** (`.claude/`, `.specify/`, `CLAUDE.md`) | 본 세션 미진행 — 옵션 B (main 변경 0) 원칙 적용. 별도 트랙 필요 시 진입 | 다음 세션 시작 시 또는 V1 release 시점 |
| **Phase 0 전체 회고** | 본 세션 미진행. PoC 0-2 단독 회고는 박힘. 본 세션 전체 (브랜치 전략 / 셋업 / 3 PoC) 의 회귀·함정 통합 회고는 미수행 | Phase 1A 진입 전 또는 별도 트랙 |
| **Kotlin 2.3.x 의 Java 25 JVM target 지원 검증** | Kotlin current stable = 2.3.21 (2026-04-23). 지원 시 Java 25 재상승 후보. `docs/poc/0-2-spring-postgres.md §5-1` 명시 | Phase 1A 이후 별도 트랙 |
| **Spring Boot dependency-management override** | Spring Boot 4.0.6 의 kotlin pinning 이 2.2.x 라 2.3.x 업그레이드 시 `ext["kotlin.version"] = "2.3.21"` 필요 | 위 Kotlin 검증과 함께 |
| **본 세션 전체 통합 회고** | retrospective 스킬로 본 세션 전반의 회귀 사례 (BE Supabase 단정 회귀 / gh active 계정 misconfig / Spring Initializr 500 / Next.js 16 breaking change 사전 docs 정독 학습) 영구화 | 사용자 결정 영역 |

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

본 세션 종료 시 컨테이너 (`write-note-postgres`) 정리. 볼륨 (`poc-spring-postgres_postgres-data`) 유지. 다음 세션 진입 시:

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
