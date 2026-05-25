# Implementation Plan: Phase 2 Backend — Project Metadata & Character CRUD

**Branch**: `004-phase-2-backend-project-character` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-phase-2-backend-project-character/spec.md`

## Summary

001 Phase 1A 의 최소 Project (`id` / `user_id` / `title` / `archived` boolean / `created_at` / `updated_at`) 와 003 Phase 1B 의 JWT 인증 컨텍스트 위에 **Week 2 백엔드 전체** 를 박는다. 산출물: SoT `docs/plan/03-backend-requirements.md` §2-2 의 Project (11 필드 확장) + Character (8 필드 신설) + Document (8 필드 신설, FK UNIQUE) 세 엔티티 + §3-3 의 프로젝트 7 endpoint + 등장인물 6 endpoint = **13 endpoint** + 본문 1:1 자동 생성 + cascade 정책. 본 spec 은 **백엔드 한정** — 홈 view / 새 프로젝트 만들기 흐름 / 메타 카드 UI / 등장인물 페이지 (Phase 2-4 ~ 2-7) 는 본 spec GREEN 직후 별도 frontend spec 진입 (Assumptions §2).

## Technical Context

**Language/Version**: Kotlin 2.2.21 on Java 24 toolchain (시스템 host = Corretto 25 — `docs/plan/00-stack §2-1`).

**Primary Dependencies** (기존 001+003 의존성 그대로, 본 spec 신규 추가 없음):
- 기존: `org.springframework.boot:spring-boot-starter-{web,security,data-jpa,validation,actuator,oauth2-client,mail}` 4.0.6, Flyway, springdoc-openapi, jjwt 0.12.x, mockito-kotlin, ktlint, Checkstyle, PostgreSQL JDBC, Testcontainers.
- 신규: **없음**. 본 spec 영역 = 도메인 entity / Service / Controller 신설·확장만. JPA + Spring Web + Validation 기존 의존성 안에서 완결.

**Storage**:
- 영속: PostgreSQL (Supabase Postgres prod / 로컬 docker `postgres:17-alpine`)
- 본 spec 의 새 마이그레이션:
  - `V5__expand_projects_and_create_character_document.sql` — 단일 마이그레이션 파일 안에 (a) `projects` 메타 5 컬럼 추가 + `archived` boolean → `archived_at` timestamp 변환 (b) `characters` 테이블 신설 + 인덱스 (c) `documents` 테이블 신설 (project_id UNIQUE) + 인덱스
- Document body 컬럼 = `JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb` (TipTap default 빈 doc 형태 — research R-3)
- 모든 FK = `ON DELETE CASCADE` (Project 영구 삭제 시 Character / Document 자동 정리 — research R-5)

**Testing**:
- 단위: JUnit 5 + AssertJ + MockK. `any()` matcher 금지 — 정확값 (`eq()` / `match { }`) (`~/.claude/rules/shared/testing-strategy.md`)
- 통합: Spring Boot Test + Testcontainers / 로컬 docker-compose. 본 spec 의 신설 영역은 JPA 1차 캐시 우회 의무 패턴 적용 (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md` — `EntityManager.flush() + clear()` 후 SELECT) — 특히 DB DEFAULT (`created_at`, `updated_at`, `document.body`) 검증
- TDD HARD-GATE: 메타 부분 수정 매핑 / archive 시각 박기 / reorder 일괄 갱신 / cascade 정책 / Document auto-provisioning 트랜잭션 정합 (`~/.claude/rules/shared/testing-strategy.md` §HARD-GATE)
- 검증 게이트: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` 단일 명령 GREEN (SC-007)
- 003 이 박은 `LoginAttemptProductionIT` 패턴 (클래스 레벨 `@Transactional` 폐기 + 비-transactional + `@AfterEach` cleanup) 은 본 spec 영역 (`@TransactionalEventListener` / `REQUIRES_NEW` 없음) 외 — 표준 클래스 레벨 `@Transactional` rollback fixture 사용 가능 (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md` §2 적용 / §3 미적용)

**Target Platform**: Render web service (Linux, 무료 plan) + 로컬 dev (macOS Darwin 25). cold start 30 초+ 감내 (`docs/plan/00-stack §2-3`).

**Project Type**: Monorepo web application — 본 feature 는 `backend/` 만 변경. `frontend/`, `docker-compose.yml`, `docs/plan/00-stack-and-schedule.md`, `docs/plan/01-phase-breakdown.md` 변경 없음. `docs/plan/02-progress.md` + vault `02-PROGRESS.md` 는 본 spec 완료 시점에 §1 / §2 갱신.

**Performance Goals**: 본인 1명 dogfooding 환경 (V1). Project 목록 조회 p95 < 500ms, 단건 조회 < 200ms, 메타 수정 < 300ms (단일 사용자 환경 기준). 단, 본 spec 의 본질 회귀 회피 = **N+1 쿼리 0 회** (SC-009) — `@EntityGraph` 또는 `JOIN FETCH` 적용 (`~/.claude/rules/java/spring/jpa-mongodb.md`).

**Constraints**:
- **외부 인프라 안전 (HARD-GATE)**: `.claude/rules/infra/external-infra-safety.md` 적용. 본 spec 의 `V5` 마이그레이션 **작성·리뷰는 OK, 적용은 사용자 명시 컨펌 후만 가능**. `archived` boolean → `archived_at` timestamp 변환은 *기존 데이터 손실 위험* — research R-1 에 마이그레이션 SQL 결정 박음 + 적용 시점 사용자 컨펌 의무.
- **`@Transactional` + 이벤트**: 본 spec 영역에는 `publishEvent` 사용 메서드 없음 (003 의 인증 이벤트와 달리 도메인 CRUD 만). 단, Week 4 메모 큐레이션 / Week 5 세션 노트 진입 시 도메인 이벤트 발행 가능성 — Project / Character 도메인 이벤트는 **본 spec scope 외**.
- **트랜잭션 정책**: 쓰기 `@Transactional(rollbackFor = [Exception::class])` — Project 생성 시 Document 자동 행 박는 트랜잭션 정합 의무 (FR-009/010). 읽기 `@Transactional(readOnly = true)`. `~/.claude/rules/kotlin/code-quality.md` § "Annotation 인자" 의 배열 인자 형식 의무.
- **모든 연관관계 `LAZY`**: JPA 엔티티 `FetchType.EAGER` 금지. Project ↔ Document 1:1 도 `LAZY` (`~/.claude/rules/java/spring/jpa-mongodb.md`).
- **JPA Cascade 정책**: research R-5 에서 결정. Project entity 의 `@OneToMany(cascade = [CascadeType.REMOVE], orphanRemoval = true)` vs DB FK `ON DELETE CASCADE` vs Service 명시 삭제 — DB FK CASCADE 채택 (Spring Data JPA 의 `deleteById` 가 자식 cascade 위임 가능 + 마이그레이션 정합).
- **DTO 네이밍**: `Create{Entity}Request` / `Update{Entity}Request` / `{Entity}Response` (`~/.claude/rules/java/spring/api-contract.md`). 메타 부분 수정은 `UpdateProjectRequest` 의 nullable 필드 + Service 레이어에서 null=미변경 / 명시값=갱신 분기.
- **Subagent 비용 인식**: 본 spec 의 phase 분해 시 LOC ~150 이하 라운드는 직접 수행. 다중 분기 (cascade 정책 / 메타 부분 수정 매핑) 만 advisor 호출 검토 (`~/.claude/rules/shared/subagent-delegation-cost.md`).
- **검증 명령 minimize**: 라운드별 좁은 테스트 (`--tests "*ProjectMetadata*"` 등) + 마지막 전체 검증 1회 (`~/.claude/rules/shared/long-running-bash.md`).

**Scale/Scope**:
- 1차 사용자 = 본인 1명 V1 dogfooding
- 본 spec 의 endpoint = **13 개** (Project 7 + Character 6) + 신설/확장 엔티티 **3 개** (Project 확장 + Character 신설 + Document 신설)
- 코드 LOC 추정 = entity (3) + repository (3) + service (2) + components (1~2 — `CharacterReorderValidator`) + controller (2) + DTO (~12 = CreateProjectRequest 확장 / UpdateProjectRequest 확장 / ProjectResponse 확장 / CreateCharacterRequest / UpdateCharacterRequest / ReorderCharactersRequest / CharacterResponse + nested 양식) + 마이그레이션 SQL 1 + 자동 회귀 테스트 (단위 ~15 + IT ~10~12). **총 ~1500~2000 LOC 추정**.
- `multi-round-implementation.md` 의 "10+ task / 다중 BC / TDD 의무" 영역 적용 — 라운드 분해 의무.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 는 default placeholder. 본 feature 의 effective gates 는 프로젝트 SoT + 글로벌·프로젝트 룰에서 도출 (003 plan 양식 정합):

- **Backend SoT gate**: 본 spec 의 모든 정책 결정은 `docs/plan/03-backend-requirements.md` (백엔드 통합 SoT) 인용 의무. 결정이 SoT 에 없으면 spec.md Assumptions 또는 research.md 에 박힌 default 로 진행 + 변경 발생 시 SoT §6 변경 이력에 행 추가 (SoT §7).
- **Context persistence gate**: 본 spec 의 모든 산출물 (spec / plan / research / data-model / contracts / quickstart / checklists) 을 `specs/004-phase-2-backend-project-character/` 에 박는다. 루트 `CLAUDE.md` 의 SPECKIT 마커를 본 plan 으로 갱신.
- **External infra safety gate (HARD-GATE)**: `.claude/rules/infra/external-infra-safety.md` 적용. `V5` 마이그레이션 **작성·리뷰 OK, 적용 (`./gradlew flywayMigrate` 또는 boot 시 자동 마이그레이션) 은 사용자 명시 컨펌 후만 가능**. 특히 `archived` boolean → `archived_at` timestamp 변환은 데이터 무손실 보장 필수 (`true` → `updated_at` 시각 / `false` → `NULL`).
- **Quality gate**: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` 단일 명령 GREEN 의무. line 120 자 / no wildcard import / ktlint_official style.
- **TDD HARD-GATE**: 메타 부분 수정 매핑 (FR-004), archive 시각 박기 (FR-002/006), reorder 일괄 갱신 (FR-016), cascade 정책 (FR-007/011), Document auto-provisioning 트랜잭션 정합 (FR-009/010), ownership 격리 (FR-008/015) 등 도메인 분기 / 매핑 / 상태 전이 영역은 RED → GREEN 의무 (`~/.claude/rules/shared/testing-strategy.md`).
- **JPA 1차 캐시 우회 의무 패턴**: 신설 `characters` / `documents` Repository 통합 테스트 + 확장 `projects` Repository 검증 테스트는 `EntityManager.flush() + clear()` 후 `findById` (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md`). DB DEFAULT (`created_at` / `updated_at` / `documents.body` JSONB default) / FK CASCADE 위반 검증 의무.
- **Subagent dispatch cost gate**: phase 분해 시 LOC > 200 + 다중 분기 + 라운드 의존 라운드만 위임 검토. dispatch prompt 에 (a) 라운드별 검증 명령 2 개 이하 (b) commit 금지 (orchestrator 가 묶어서 commit) (c) tool_uses 50 cap (d) 같은 에러 3 회 재시도 금지 명시 (`~/.claude/rules/shared/subagent-delegation-cost.md`). 본 spec 은 LOC ~1500~2000 / 다중 라운드 / TDD 의무 → 라운드 분해 + 일부 라운드 위임 검토 (특히 entity + migration + Document auto-provisioning 라운드).
- **API contract gate**: 모든 응답은 `Result<T>` envelope (001 도입) 통일 (FR-017). DTO 네이밍 `Create{Entity}Request` / `Update{Entity}Request` / `{Entity}Response` (`~/.claude/rules/java/spring/api-contract.md`).
- **JPA fetch 정책**: 모든 연관관계 `LAZY`, `FetchType.EAGER` 금지. Project ↔ Character 의 `@OneToMany`, Project ↔ Document 의 `@OneToOne` 모두 `LAZY`. `findAll()` 무제한 호출 금지 — `Pageable` 의무 (FR-018).
- **트랜잭션 정책**: 쓰기 `@Transactional(rollbackFor = [Exception::class])` (배열 인자 형식 — `~/.claude/rules/kotlin/code-quality.md`), 읽기 `@Transactional(readOnly = true)`. Project 생성 트랜잭션 안에서 Document 자동 행 박는 동작 정합 의무 (FR-010 — 본문 자동 생성 실패 시 Project 트랜잭션 전체 롤백).
- **N+1 회피 gate (HARD-GATE)**: Project 목록 조회 / Character 목록 조회 / Project 단건 조회 (Document title / Character 카운트 표시 가능성) 모두 `@EntityGraph` 또는 `JOIN FETCH` 또는 DTO Projection 적용 (FR-019, SC-009). 검증 = 통합 테스트에서 Hibernate SQL 로그 카운트 또는 명시 assertion.
- **Frontend trigger gate**: 본 spec 완료 시점 (백엔드 GREEN) 에 (a) vault `~/obsidian/write-note/02-PROGRESS.md §2 "다음 진입점"` 에 frontend spec 진입 명시 추가 (b) 본 repo `docs/plan/02-progress.md` 의 §1 또는 §2 에 본 spec 완료 + frontend 트리거 박는다 (spec.md Assumptions §1·§2 의 자동 후속 액션).

**Initial gate status: PASS**. Complexity Tracking 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/004-phase-2-backend-project-character/
├── spec.md                          # /speckit-specify 결과 (5 User Story + 23 FR + 10 SC)
├── plan.md                          # 본 파일 (/speckit-plan)
├── research.md                      # Phase 0 — 결정 + 근거 + 대안 (R-1 ~ R-9)
├── data-model.md                    # Phase 1 — Project 확장 + Character 신설 + Document 신설 + V5 마이그레이션 SQL 스케치
├── quickstart.md                    # Phase 1 — 로컬 dogfooding 진입 절차
├── contracts/
│   ├── project-endpoints.md         # SoT §3-3 의 Project 7 endpoint request/response/error 매트릭스
│   ├── character-endpoints.md       # SoT §3-3 의 Character 6 endpoint (nested 경로) request/response/error 매트릭스
│   └── cascade-and-auto-provisioning.md  # Project 생성 시 Document 자동 행 + Project 삭제 시 cascade 정합 + Project archived 마이그레이션 정책
└── checklists/
    └── requirements.md              # /speckit-specify 단계 산출 (16/16 ✓)
```

### Source Code (repository root)

```text
backend/                                     # 본 spec 의 모든 변경 영역
├── src/main/kotlin/com/writenote/
│   ├── controller/
│   │   ├── ProjectController.kt             # 7 endpoint (확장 — 003 의 5 endpoint → archive/unarchive/delete 추가)
│   │   └── CharacterController.kt           # 6 endpoint 신설 (nested `/api/projects/{projectId}/characters/...`)
│   ├── service/
│   │   ├── ProjectService.kt                # 확장 — 메타 5 필드 + archive/unarchive/delete + Document auto-provisioning
│   │   └── CharacterService.kt              # 신설 — CRUD + reorder + ownership 검증 (projectId → userId 확인)
│   ├── components/
│   │   └── characters/
│   │       └── CharacterReorderValidator.kt # 신설 — 전체 인물 ID 누락 검증 / 중복 검증 / 외부 ID 차단
│   ├── repository/
│   │   ├── ProjectRepository.kt             # 확장 — `findAllByUserIdAndArchivedAtIsNull(Pageable)` / `findAllByUserIdAndArchivedAtIsNotNull(Pageable)` / `@EntityGraph` 적용
│   │   ├── CharacterRepository.kt           # 신설 — `findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc`
│   │   └── DocumentRepository.kt            # 신설 — `findByProjectId(projectId)` (1:1 lookup)
│   ├── entity/
│   │   ├── Project.kt                       # 확장 — genre / targetLength / toneNotes / synopsis / worldNotes / archivedAt (BOOLEAN archived 폐기)
│   │   ├── Character.kt                     # 신설 — 8 필드 + Project N:1 + display_order
│   │   └── Document.kt                      # 신설 — 8 필드 + Project 1:1 (UNIQUE) + body JSONB
│   ├── model/
│   │   ├── request/
│   │   │   ├── CreateProjectRequest.kt      # 확장 — 메타 5 필드 추가 (모두 nullable)
│   │   │   ├── UpdateProjectRequest.kt      # 확장 — 메타 5 필드 추가 (부분 수정 정합)
│   │   │   ├── CreateCharacterRequest.kt    # 신설 — name (필수) + shortDescription + notes + displayOrder default 0
│   │   │   ├── UpdateCharacterRequest.kt    # 신설 — name / shortDescription / notes 부분 수정
│   │   │   └── ReorderCharactersRequest.kt  # 신설 — characterIds: List<Long> (전체 인물 순서)
│   │   └── response/
│   │       ├── ProjectResponse.kt           # 확장 — 메타 5 필드 + archivedAt
│   │       └── CharacterResponse.kt         # 신설
│   ├── mapper/
│   │   └── (필요 시 ProjectMapper / CharacterMapper — KMapper 없이 직접 매핑 우선)
│   ├── error/
│   │   └── ErrorCode.kt                     # 확장 — `RESOURCE_NOT_FOUND` 재사용. 본 spec 신규 코드 없음 (cascade 영향은 ResourceNotFoundException 으로 통일)
│   └── config/
│       └── (변경 없음 — SecurityConfig 의 `/api/projects/**` 매핑 003 에서 이미 박힘)
├── src/main/resources/
│   └── db/migration/
│       └── V5__expand_projects_and_create_character_document.sql  # 본 spec 의 유일한 마이그레이션
└── src/test/kotlin/com/writenote/
    ├── controller/
    │   ├── ProjectControllerIT.kt           # 확장 — 003 의 IT 위에 archive/unarchive/delete + 메타 수정 케이스
    │   ├── ProjectControllerOwnerCleanupTest.kt  # 003 박힘 — 본 spec 회귀 검증 위해 유지 (FR-008 정합)
    │   └── CharacterControllerIT.kt         # 신설 — 6 endpoint × happy / forbidden / not-found / reorder 케이스
    ├── service/
    │   ├── ProjectServiceTest.kt            # 확장 — 메타 부분 수정 / archive 시각 박기 / Document auto-provisioning 트랜잭션 정합 / cascade
    │   └── CharacterServiceTest.kt          # 신설 — CRUD + reorder + ownership
    ├── components/
    │   └── characters/
    │       └── CharacterReorderValidatorTest.kt  # 신설 — 누락 / 중복 / 외부 ID 4 케이스
    └── repository/
        ├── ProjectRepositoryIT.kt           # 신설 — `findAll*ArchivedAt*` + N+1 회피 검증
        ├── CharacterRepositoryIT.kt         # 신설 — display_order 정렬 + 동순위 created_at 정렬
        └── DocumentRepositoryIT.kt          # 신설 — 1:1 lookup + body JSONB default 검증
```

**Structure Decision**: Monorepo web application. 본 spec 의 변경은 `backend/` 모듈에 한정. `frontend/` 는 별도 후속 spec (예: `005-phase-2-frontend-views`) 에서 진행 — 본 spec GREEN 직후 트리거. 003 plan 양식 정합 (계층별 패키지 + 글로벌 `~/.claude/rules/java/spring/spring-patterns.md` 정합 + components 패키지 활용).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |

본 spec 의 모든 결정은 기존 룰 정합 + SoT §3-3 13 endpoint 매핑 안에서 완결. 신규 패턴 (`components/characters/` 하위 패키지 하나) 외 새 추상화 없음. Constitution Check 위반 0건.
