# Phase 1A Backend Foundation Quickstart

## Prerequisites

- Java toolchain compatible with the backend Gradle wrapper; project target remains Java 24.
- Docker available for local PostgreSQL.
- Run commands from the repository root unless otherwise noted.

## 1. Start Local PostgreSQL

```bash
docker compose up -d --wait postgres
```

If working from another worktree and you need to share the same local database volume, use an explicit compose project name:

```bash
docker compose --project-name write-note up -d --wait postgres
```

## 2. Backend Verification

```bash
cd backend
./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

Expected result:

```text
BUILD SUCCESSFUL
```

## 3. Run Backend Locally

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Expected checks:

- Backend starts on port `8080`.
- Health endpoint is available.
- OpenAPI UI is available if springdoc initializes successfully.
- No production credentials are required.

## 4. Smoke Project Flow

Use the temporary Phase 1A ownership header. Replace `1` with a real seeded or test-created user id.

```bash
curl -s -X POST http://localhost:8080/api/projects \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 1' \
  -d '{"title":"첫 단막극"}'
```

```bash
curl -s 'http://localhost:8080/api/projects?page=0&size=20' \
  -H 'X-User-Id: 1'
```

Expected:

- Responses use `{ "success": true, "data": ..., "error": null }`.
- Validation or missing-resource failures use `{ "success": false, "data": null, "error": ... }`.
- Cross-user project access returns a not-found response.

## 5. Safety Notes

- Do not read `.env*` files or print secret environment variables.
- Do not run direct database DDL/DML manually without explicit user confirmation.
- Migration files and rollback-based automated tests are allowed.

