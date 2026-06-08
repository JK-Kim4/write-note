# Tasks: Phase 1A Backend Foundation

**Input**: Design documents from `/specs/001-phase-1a-backend-scaffold/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/project-api.md](./contracts/project-api.md), [quickstart.md](./quickstart.md)

**Tests**: Test tasks are included because the specification requires automated persistence checks, representative response-envelope checks, ownership-scope checks, and a repeatable verification flow.

**Organization**: Tasks are grouped by user story so each story can be completed and tested as an independent increment after the shared foundation is in place.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks in the same phase.
- **[Story]**: Maps to the user story from `spec.md`.
- Every task includes exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish backend build, quality gates, and package directories before feature work.

- [X] T001 Modify backend Gradle plugins and dependencies in `backend/build.gradle.kts` for actuator, springdoc, ktlint, Checkstyle, AssertJ, and MockK.
- [X] T002 Create Checkstyle rules in `backend/config/checkstyle/checkstyle.xml` for 120-character line length and wildcard import rejection.
- [X] T003 [P] Create backend package directories under `backend/src/main/kotlin/com/writenote/{config,controller,entity,error,mapper,model/request,model/response,repository,service}`.
- [X] T004 [P] Create backend test package directories under `backend/src/test/kotlin/com/writenote/{controller,repository}`.
- [X] T005 Run `cd backend && ./gradlew tasks --all` and confirm ktlint/checkstyle-related tasks are available before implementation continues.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace PoC configuration with the real Phase 1A runtime baseline that all stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Delete PoC runtime files `backend/src/main/kotlin/com/writenote/poc/PingEntity.kt` and `backend/src/main/kotlin/com/writenote/poc/PingRepository.kt`.
- [X] T007 Delete PoC test file `backend/src/test/kotlin/com/writenote/poc/PingRepositoryIT.kt`.
- [X] T008 Delete PoC migration file `backend/src/main/resources/db/migration/V1__create_ping.sql`.
- [X] T009 Replace `backend/src/main/resources/application.properties` with `backend/src/main/resources/application.yml`.
- [X] T010 [P] Create local profile configuration in `backend/src/main/resources/application-local.yml`.
- [X] T011 [P] Create test profile configuration in `backend/src/main/resources/application-test.yml`.
- [X] T012 [P] Create production profile configuration with environment-variable placeholders only in `backend/src/main/resources/application-prod.yml`.
- [X] T013 Create Spring Security permit-all baseline for Phase 1A in `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt`.
- [X] T014 Create OpenAPI metadata configuration in `backend/src/main/kotlin/com/writenote/config/OpenApiConfig.kt`.
- [X] T015 Create CORS configuration backed by configured frontend origins in `backend/src/main/kotlin/com/writenote/config/CorsConfig.kt`.
- [X] T016 Update smoke test to use the test profile in `backend/src/test/kotlin/com/writenote/BackendApplicationTests.kt`.

**Checkpoint**: Foundation ready; PoC runtime files are gone, profiles exist, security/CORS/OpenAPI baseline compiles, and user-story implementation can begin.

---

## Phase 3: User Story 1 - Clean Backend Foundation (Priority: P1)

**Goal**: Replace proof-of-concept persistence with the first real account schema and entity foundation.

**Independent Test**: Start from a fresh local data store and confirm the backend initializes with real account data structures and zero runtime references to PoC `Ping` artifacts.

### Tests for User Story 1

- [X] T017 [P] [US1] Create User repository integration test in `backend/src/test/kotlin/com/writenote/repository/UserRepositoryIT.kt` covering insert, flush, clear, select, created timestamp, and unique email conflict.
- [X] T018 [P] [US1] Add no-PoC-artifact guard test in `backend/src/test/kotlin/com/writenote/BackendApplicationTests.kt` checking no `com.writenote.poc` classes are present.

### Implementation for User Story 1

- [X] T019 [US1] Create users migration in `backend/src/main/resources/db/migration/V1__create_users.sql`.
- [X] T020 [US1] Create User entity in `backend/src/main/kotlin/com/writenote/entity/User.kt`.
- [X] T021 [US1] Create User repository in `backend/src/main/kotlin/com/writenote/repository/UserRepository.kt`.
- [X] T022 [US1] Run `cd backend && ./gradlew test --tests "*UserRepositoryIT" --tests "*BackendApplicationTests"` and verify User persistence and PoC guard pass.

**Checkpoint**: User Story 1 is complete when real account persistence works and PoC backend artifacts are absent from runtime and tests.

---

## Phase 4: User Story 2 - Environment-Safe Configuration (Priority: P2)

**Goal**: Ensure local, test, and production configuration paths are separated and production secrets are not committed.

**Independent Test**: Run backend tests with the test profile and inspect committed configuration to confirm production-only values are environment placeholders.

### Tests for User Story 2

- [X] T023 [P] [US2] Create profile configuration integration test in `backend/src/test/kotlin/com/writenote/BackendApplicationTests.kt` verifying the test profile starts without production secrets.
- [X] T024 [P] [US2] Add configuration placeholder assertions in `backend/src/test/kotlin/com/writenote/BackendApplicationTests.kt` for production datasource values.

### Implementation for User Story 2

- [X] T025 [US2] Refine `backend/src/main/resources/application.yml` defaults for application name, active local profile behavior, JPA validation, Flyway, logging, and management exposure.
- [X] T026 [US2] Refine `backend/src/main/resources/application-local.yml` for local docker PostgreSQL connection and local frontend origin.
- [X] T027 [US2] Refine `backend/src/main/resources/application-test.yml` for test execution against local PostgreSQL with rollback-based tests.
- [X] T028 [US2] Refine `backend/src/main/resources/application-prod.yml` to use only environment-variable placeholders for datasource URL, username, password, and frontend origins.
- [X] T029 [US2] Run `cd backend && ./gradlew test --tests "*BackendApplicationTests"` and verify profile tests pass without production credentials.

**Checkpoint**: User Story 2 is complete when backend tests run without production secrets and committed production config contains placeholders only.

---

## Phase 5: User Story 3 - Standard Response and Error Contract (Priority: P3)

**Goal**: Provide a consistent response envelope and global error handling for success, validation, conflict, not-found, invalid parameter, and internal-error outcomes.

**Independent Test**: Invoke representative success and failure cases and confirm every response has the same success/data/error envelope.

### Tests for User Story 3

- [X] T030 [P] [US3] Create response envelope integration tests in `backend/src/test/kotlin/com/writenote/controller/ResponseContractIT.kt` for validation and invalid-parameter failures using test-only controller fixtures.
- [X] T031 [P] [US3] Create error contract tests in `backend/src/test/kotlin/com/writenote/controller/ResponseContractIT.kt` for not-found and conflict responses using test-only controller fixtures.

### Implementation for User Story 3

- [X] T032 [US3] Create `ErrorInfo` response model in `backend/src/main/kotlin/com/writenote/model/response/ErrorInfo.kt`.
- [X] T033 [US3] Create generic `Result` response model in `backend/src/main/kotlin/com/writenote/model/response/Result.kt`.
- [X] T034 [US3] Create `PageResponse` response model in `backend/src/main/kotlin/com/writenote/model/response/PageResponse.kt`.
- [X] T035 [US3] Create `ErrorCode` enum in `backend/src/main/kotlin/com/writenote/error/ErrorCode.kt`.
- [X] T036 [US3] Create `ResourceNotFoundException` in `backend/src/main/kotlin/com/writenote/error/ResourceNotFoundException.kt`.
- [X] T037 [US3] Create global exception handler in `backend/src/main/kotlin/com/writenote/error/GlobalExceptionHandler.kt` for validation, malformed parameters, not-found, conflict, and unexpected exceptions.
- [X] T038 [US3] Create basic health controller or health route adapter in `backend/src/main/kotlin/com/writenote/controller/HealthController.kt` if actuator-only health does not satisfy local smoke checks.
- [X] T039 [US3] Run `cd backend && ./gradlew test --tests "*ResponseContractIT"` and verify response-envelope tests pass.

**Checkpoint**: User Story 3 is complete when every representative success and error path uses the standard envelope.

---

## Phase 6: User Story 4 - Project CRUD Pattern Baseline (Priority: P4)

**Goal**: Implement minimal ownership-scoped Project CRUD to prove controller, service, repository, validation, pagination, archive behavior, and persistence patterns.

**Independent Test**: Create, list, read, update, and archive projects for one user context and verify another user context receives not-found.

### Tests for User Story 4

- [X] T040 [P] [US4] Create Project repository integration test in `backend/src/test/kotlin/com/writenote/repository/ProjectRepositoryIT.kt` covering insert, flush, clear, select, active listing, archive exclusion, and user scoping.
- [X] T041 [P] [US4] Create Project API integration test in `backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt` for create, list, get, update, archive, validation failure, missing user header, and cross-user not-found.

### Implementation for User Story 4

- [X] T042 [US4] Create projects migration in `backend/src/main/resources/db/migration/V2__create_projects.sql`.
- [X] T043 [US4] Create Project entity in `backend/src/main/kotlin/com/writenote/entity/Project.kt`.
- [X] T044 [US4] Create Project repository in `backend/src/main/kotlin/com/writenote/repository/ProjectRepository.kt` with owner-scoped lookup and paginated active listing.
- [X] T045 [US4] Create request DTOs in `backend/src/main/kotlin/com/writenote/model/request/CreateProjectRequest.kt` and `backend/src/main/kotlin/com/writenote/model/request/UpdateProjectRequest.kt`.
- [X] T046 [US4] Create Project response DTO in `backend/src/main/kotlin/com/writenote/model/response/ProjectResponse.kt`.
- [X] T047 [US4] Create Project mapper in `backend/src/main/kotlin/com/writenote/mapper/ProjectMapper.kt`.
- [X] T048 [US4] Create Project service in `backend/src/main/kotlin/com/writenote/service/ProjectService.kt` with temporary user id parameter, ownership scoping, pagination, update, and archive behavior.
- [X] T049 [US4] Create Project controller in `backend/src/main/kotlin/com/writenote/controller/ProjectController.kt` using `X-User-Id` temporary ownership context and the standard response envelope.
- [X] T050 [US4] Document the temporary `X-User-Id` replacement requirement in `specs/001-phase-1a-backend-scaffold/contracts/project-api.md`.
- [X] T051 [US4] Run `cd backend && ./gradlew test --tests "*ProjectRepositoryIT" --tests "*ProjectControllerIT"` and verify Project CRUD behavior passes.

**Checkpoint**: User Story 4 is complete when the minimal Project CRUD slice matches `contracts/project-api.md` and all access is owner-scoped.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full Phase 1A foundation and update project progress context.

- [X] T052 Run full backend verification from `specs/001-phase-1a-backend-scaffold/quickstart.md`: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`.
- [X] T053 [P] Update Phase 1A completion notes and next entry point in `docs/plan/02-progress.md`.
- [X] T054 [P] Update backend commands in `CLAUDE.md` after verification commands are final.
- [X] T055 [P] Update backend commands in `README.md` if local setup or verification commands changed.
- [X] T056 Confirm `backend/src/main/kotlin/com/writenote/poc/`, `backend/src/test/kotlin/com/writenote/poc/`, and `backend/src/main/resources/db/migration/V1__create_ping.sql` are absent.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1.
- **Phase 3 US1**: Depends on Phase 2.
- **Phase 4 US2**: Depends on Phase 2; can proceed after US1 if profile tests need real migrations to start cleanly.
- **Phase 5 US3**: Depends on Phase 2 and is independently testable with response-contract fixtures.
- **Phase 6 US4**: Depends on US1 for user persistence and US3 for response models.
- **Phase 7 Polish**: Depends on all selected user stories.

### User Story Dependencies

- **US1 Clean Backend Foundation**: First MVP slice; establishes real account schema and removes PoC runtime artifacts.
- **US2 Environment-Safe Configuration**: Can be tested independently after foundational profiles exist.
- **US3 Standard Response and Error Contract**: Shared contract needed by US4 and later Week 1B authentication.
- **US4 Project CRUD Pattern Baseline**: Depends on US1 user persistence and US3 response/error contract.

### Within Each User Story

- Tests are listed before implementation tasks.
- Entities and migrations come before repositories.
- Repositories come before services.
- Services come before controllers.
- Controller and repository tests must pass before moving to polish.

### Parallel Opportunities

- T003 and T004 can run in parallel after T001 starts.
- T010, T011, and T012 can run in parallel after T009.
- T017 and T018 can run in parallel.
- T023 and T024 can run in parallel.
- T030 and T031 can run in parallel.
- T040 and T041 can run in parallel after US3 response contract files exist.
- T053, T054, and T055 can run in parallel after full verification.

## Parallel Example: User Story 4

```bash
# Repository behavior and HTTP contract tests can be drafted together:
Task: "T040 [P] [US4] Create Project repository integration test in backend/src/test/kotlin/com/writenote/repository/ProjectRepositoryIT.kt"
Task: "T041 [P] [US4] Create Project API integration test in backend/src/test/kotlin/com/writenote/controller/ProjectControllerIT.kt"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 and verify real account persistence replaces PoC artifacts.
3. Stop and validate before adding the Project CRUD pattern.

### Incremental Delivery

1. Setup + Foundational baseline.
2. US1: Clean backend foundation.
3. US2: Environment-safe configuration.
4. US3: Shared response/error contract.
5. US4: Minimal Project CRUD.
6. Polish: full verification and progress docs.

### Notes

- Keep `X-User-Id` isolated to Phase 1A Project CRUD and documented for replacement in Week 1B.
- Do not implement JWT, Kakao OAuth, email/password login, refresh tokens, full project metadata, Character CRUD, frontend UI, deployment, or PWA caching in these tasks.
- Do not run direct database DDL/DML manually. Migration files and rollback-based automated tests are allowed.
- Commit after each completed phase or coherent story slice, keeping unrelated existing worktree changes out of the commit.
