# Phase 1A Backend Foundation Research

## Decision: Keep Kotlin 2.2.21 with Java 24 toolchain

**Rationale**: Phase 0-2 already proved that Kotlin 2.2.21 does not support JVM target 25 cleanly in this project. Java 24 is the verified Spring Initializr-compatible toolchain for the current Spring Boot 4.0.6 setup.

**Alternatives considered**:

- Java 25: rejected for Phase 1A because PoC 0-2 hit `compileJava(25)` vs `compileKotlin(24)` target mismatch.
- Kotlin 2.3.x upgrade: deferred as a separate research track because it requires Spring Boot dependency-management override and is not needed for the foundation.
- Java 21: unnecessary downgrade because Java 24 already passed the PoC.

## Decision: Add Spring Boot Actuator for health checks

**Rationale**: Phase 1A needs a basic service health signal for local checks and later Render deployment. Actuator is the standard Spring Boot dependency for health endpoints and keeps custom health code minimal.

**Alternatives considered**:

- Custom health controller only: acceptable for a small app but duplicates standard health behavior needed for hosting.
- Defer health check: rejected because `docs/plan/02-progress.md` lists actuator as immediate 1A-1 work.

## Decision: Use springdoc OpenAPI starter `3.0.3`

**Rationale**: `docs/plan/00-stack-and-schedule.md` selects springdoc-openapi for API documentation. Maven Central lists `org.springdoc:springdoc-openapi-starter-webmvc-ui` `3.0.3` as the latest non-milestone artifact available on 2026-04-11. Phase 1A should pin a concrete version and verify it during build.

**Alternatives considered**:

- `2.8.17`: latest 2.x line on Maven Central, but Spring Boot 4.x is better aligned with the newer 3.x line.
- Dynamic `latest.release`: rejected for reproducibility.
- Defer OpenAPI: rejected because Phase 1A explicitly includes springdoc.

**Source**: Maven Central listing for `org.springdoc:springdoc-openapi-starter-webmvc-ui` shows `3.0.3` published on 2026-04-11.

## Decision: Use ktlint Gradle plugin `14.2.0`

**Rationale**: Project rules require ktlint checks. The Gradle Plugin Portal lists `org.jlleitschuh.gradle.ktlint` version `14.2.0` as latest, created 2026-03-12, and provides the Gradle plugins DSL snippet.

**Alternatives considered**:

- Older 13.x plugin: no project-specific need to stay back.
- Manual ktlint CLI: rejected because Gradle tasks are easier to include in the standard verification flow.

**Source**: Gradle Plugin Portal page for `org.jlleitschuh.gradle.ktlint`.

## Decision: Use Checkstyle as a Gradle plugin with a minimal backend config

**Rationale**: Project rules require Checkstyle with line length and no wildcard import checks. The Gradle built-in Checkstyle plugin avoids adding a third-party plugin and integrates with `check`.

**Alternatives considered**:

- Rely on ktlint only: rejected because project docs explicitly name Checkstyle.
- Add Detekt/Kover now: deferred because Phase 1A docs call for ktlint and Checkstyle; detekt/kover are global-rule examples but not required by the current Phase 1A plan.

## Decision: Use local docker-compose PostgreSQL for Phase 1A integration tests

**Rationale**: PoC 0-2 and the project JPA test rule choose docker-compose PostgreSQL for single-developer dogfooding. It keeps local iteration fast and avoids introducing Testcontainers setup before CI exists.

**Alternatives considered**:

- Testcontainers now: useful for CI and multi-developer repeatability, but adds setup cost before CI exists.
- H2: rejected because PostgreSQL defaults, constraints, and Flyway behavior should be validated against the real target database.

## Decision: Replace PoC migration with real V1 users migration

**Rationale**: PoC files explicitly declare themselves disposable. Phase 1A is the first real schema baseline, so `V1__create_ping.sql` must be removed and replaced with `V1__create_users.sql`. Since this is still pre-release local development, resetting local dev DB state is acceptable when applying the new migration baseline.

**Alternatives considered**:

- Keep `V1__create_ping.sql` and add `V2__create_users.sql`: rejected because it preserves throwaway schema in the real baseline.
- Add a migration that drops `ping`: unnecessary because `ping` is not production data and Phase 1A starts the real baseline.

## Decision: Use temporary `X-User-Id` ownership context for Project CRUD

**Rationale**: The spec requires ownership-scoped Project behavior before authentication exists. Week 1B will replace temporary context with authenticated identity. A single explicit header keeps Phase 1A testable while preventing fake global access patterns from spreading.

**Alternatives considered**:

- Hardcode user id: rejected because it cannot test cross-user isolation.
- Implement JWT now: rejected because JWT and login are Week 1B scope.
- Skip ownership until authentication: rejected because service/repository scoping is a foundational contract in `docs/plan/00-stack-and-schedule.md`.

## Decision: Minimal Project fields only in Phase 1A

**Rationale**: Phase 1A project CRUD is a pattern verification slice. Full Project metadata belongs to Week 2. Minimal fields are enough to validate lifecycle, pagination, archive behavior, and user scoping.

**Alternatives considered**:

- Implement full Project fields now: rejected as scope creep into Week 2.
- Skip Project CRUD: rejected because 1A-5 explicitly requires end-to-end CRUD to validate the pattern.

