# Implementation Plan: Phase 1A Backend Foundation

**Branch**: `001-phase-1a-backend-scaffold` | **Date**: 2026-05-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-phase-1a-backend-scaffold/spec.md`

## Summary

Replace the Phase 0 proof-of-concept backend with the first real V1 backend foundation. The implementation establishes build quality gates, profile-based configuration, the first account schema, a shared response/error contract, CORS/security baseline, and a minimal Project CRUD slice that proves ownership-scoped service/repository/controller patterns before Week 1B authentication and Week 2 full project features.

## Technical Context

**Language/Version**: Kotlin 2.2.21, Java 24 Gradle toolchain, Spring Boot 4.0.6

**Primary Dependencies**: Spring WebMVC, Spring Security, Spring Data JPA, Spring Validation, Flyway, PostgreSQL driver, Jackson Kotlin module, Spring Boot Actuator, springdoc-openapi starter, ktlint Gradle plugin, Checkstyle, JUnit 5, Spring Boot Test, AssertJ, MockK

**Storage**: PostgreSQL 17 locally via `docker-compose.yml`; production path is Supabase Postgres with credentials supplied by environment variables only

**Testing**: Gradle test suite with Spring Boot integration tests; repository tests use real PostgreSQL and `EntityManager.flush()` + `EntityManager.clear()` for write-then-read verification

**Target Platform**: Backend web service for local development, Render free web service later, consumed by Next.js frontend and PWA clients

**Project Type**: Monorepo web application; this feature changes only `backend/` plus Speckit docs and root agent context

**Performance Goals**: Phase 1A endpoints are functional baselines; paginated project listing must avoid unbounded reads and return recent-project order deterministically for small local datasets

**Constraints**: No production secrets in source; no direct DB write commands outside rollback-based tests without explicit user confirmation; keep Java toolchain at 24; no JWT/OAuth/email auth implementation in this phase; temporary ownership context must be documented for removal in Week 1B

**Scale/Scope**: Single-user dogfooding V1 foundation, but all data access must already be user-scoped so future multi-user access does not require a rewrite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The local `.specify/memory/constitution.md` still contains the default placeholder constitution and no ratified project-specific gates. For this feature, the effective gates come from the project plan and rules:

- **Context persistence gate**: Keep feature-specific docs in `specs/001-phase-1a-backend-scaffold/` and update `AGENTS.md` to point future agents at this plan.
- **Safety gate**: Do not read `.env*`, print secrets, or run direct DDL/DML against PostgreSQL. Migration files and rollback-based tests are allowed.
- **Quality gate**: Implementation must provide repeatable Gradle verification for formatting, Checkstyle, tests, and build.
- **Persistence gate**: Repository tests that verify DB defaults or constraints must flush and clear before reading.
- **Scope gate**: Authentication mechanics, full project metadata, character management, frontend UI, deployment, and PWA changes are out of scope.

Initial gate status: **PASS**. No violations requiring complexity justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-phase-1a-backend-scaffold/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── project-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── build.gradle.kts
├── config/
│   └── checkstyle/checkstyle.xml
└── src/
    ├── main/
    │   ├── kotlin/com/writenote/
    │   │   ├── BackendApplication.kt
    │   │   ├── config/
    │   │   │   ├── CorsConfig.kt
    │   │   │   ├── OpenApiConfig.kt
    │   │   │   └── SecurityConfig.kt
    │   │   ├── controller/
    │   │   │   ├── HealthController.kt
    │   │   │   └── ProjectController.kt
    │   │   ├── entity/
    │   │   │   ├── Project.kt
    │   │   │   └── User.kt
    │   │   ├── error/
    │   │   │   ├── ErrorCode.kt
    │   │   │   ├── GlobalExceptionHandler.kt
    │   │   │   └── ResourceNotFoundException.kt
    │   │   ├── mapper/
    │   │   │   └── ProjectMapper.kt
    │   │   ├── model/
    │   │   │   ├── request/
    │   │   │   │   ├── CreateProjectRequest.kt
    │   │   │   │   └── UpdateProjectRequest.kt
    │   │   │   └── response/
    │   │   │       ├── ErrorInfo.kt
    │   │   │       ├── PageResponse.kt
    │   │   │       ├── ProjectResponse.kt
    │   │   │       └── Result.kt
    │   │   ├── repository/
    │   │   │   ├── ProjectRepository.kt
    │   │   │   └── UserRepository.kt
    │   │   └── service/
    │   │       └── ProjectService.kt
    │   └── resources/
    │       ├── application.yml
    │       ├── application-local.yml
    │       ├── application-prod.yml
    │       ├── application-test.yml
    │       └── db/migration/
    │           ├── V1__create_users.sql
    │           └── V2__create_projects.sql
    └── test/kotlin/com/writenote/
        ├── BackendApplicationTests.kt
        ├── controller/
        │   └── ProjectControllerIT.kt
        └── repository/
            ├── ProjectRepositoryIT.kt
            └── UserRepositoryIT.kt
```

**Structure Decision**: Follow the existing monorepo split and the backend package structure defined in `docs/plan/00-stack-and-schedule.md`. This feature does not introduce a separate module or frontend package. `Ping` PoC files are removed rather than migrated.

## Complexity Tracking

No constitution violations or structural complexity exceptions.

## Phase 0: Research

See [research.md](./research.md).

Key decisions:

- Keep Kotlin 2.2.21 + Java 24 toolchain because PoC 0-2 proved Kotlin JVM target 25 incompatibility.
- Use `springdoc-openapi-starter-webmvc-ui` `3.0.3` unless implementation testing finds Spring Boot 4 incompatibility.
- Use `org.jlleitschuh.gradle.ktlint` `14.2.0` for ktlint Gradle tasks.
- Use a temporary `X-User-Id` ownership header only for Phase 1A Project CRUD, documented and isolated for replacement by Week 1B authentication.
- Keep local docker-compose PostgreSQL for Phase 1A tests; defer Testcontainers until CI or multi-developer setup requires it.

## Phase 1: Design & Contracts

Design outputs:

- [data-model.md](./data-model.md) defines `User`, `Project`, response envelope, page envelope, and error codes.
- [contracts/project-api.md](./contracts/project-api.md) defines the minimal Project CRUD HTTP contract for Phase 1A.
- [quickstart.md](./quickstart.md) defines setup and verification commands.
- [AGENTS.md](../../AGENTS.md) is updated so future agents read this plan as the current feature context.

Post-design gate status: **PASS**.

Scope remains bounded to backend foundation. The plan intentionally defers authentication, Kakao OAuth, refresh tokens, full project metadata, Character CRUD, frontend views, deployment setup, and PWA caching strategy.

