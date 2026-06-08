# Phase 1A Project API Contract

This contract defines the temporary Phase 1A Project CRUD surface. Authentication is not implemented yet; ownership context is passed with `X-User-Id` only for this phase and must be replaced by authenticated principal identity in Week 1B.

## Shared Headers

| Header | Required | Description |
|---|---:|---|
| `Content-Type: application/json` | For request bodies | JSON request payload |
| `X-User-Id` | Yes | Temporary owner context for Phase 1A only |

## Temporary Ownership Context

`X-User-Id` exists only to make Phase 1A ownership scoping testable before authentication is implemented.
Week 1B must replace this header with the authenticated principal user id and remove direct client control over owner identity.

## Shared Response Envelope

### Success

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

### Failure

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "title: must not be blank"
  }
}
```

## Create Project

`POST /api/projects`

### Request

```json
{
  "title": "첫 단막극"
}
```

### Success: `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "첫 단막극",
    "archived": false,
    "createdAt": "2026-05-20T00:00:00Z",
    "updatedAt": "2026-05-20T00:00:00Z"
  },
  "error": null
}
```

### Failures

| Status | Code | Condition |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Blank or invalid title |
| 400 | `INVALID_PARAMETER` | Missing or invalid `X-User-Id` |
| 404 | `NOT_FOUND` | User context does not reference an existing user |

## List Active Projects

`GET /api/projects?page=0&size=20&sort=updatedAt,desc`

### Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 1,
        "title": "첫 단막극",
        "archived": false,
        "createdAt": "2026-05-20T00:00:00Z",
        "updatedAt": "2026-05-20T00:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  },
  "error": null
}
```

### Rules

- Returns only projects owned by `X-User-Id`.
- Excludes archived projects.
- Defaults to recent update order.
- Validates page and size to avoid unbounded reads.

## Get Project

`GET /api/projects/{projectId}`

### Success: `200 OK`

Returns the same `ProjectResponse` shape as Create Project.

### Failures

| Status | Code | Condition |
|---:|---|---|
| 400 | `INVALID_PARAMETER` | Invalid project id or user id |
| 404 | `NOT_FOUND` | Project is missing, archived visibility is disallowed, or project belongs to another user |

## Update Project

`PATCH /api/projects/{projectId}`

### Request

```json
{
  "title": "수정된 단막극"
}
```

### Success: `200 OK`

Returns the updated `ProjectResponse`.

### Failures

| Status | Code | Condition |
|---:|---|---|
| 400 | `VALIDATION_FAILED` | Blank or invalid title |
| 400 | `INVALID_PARAMETER` | Invalid project id or user id |
| 404 | `NOT_FOUND` | Project is missing or belongs to another user |

## Archive Project

`PATCH /api/projects/{projectId}/archive`

### Success: `200 OK`

Returns the archived `ProjectResponse` with `archived: true`.

### Rules

- Archiving an already archived project is idempotent.
- Archived projects are retained.
- Active list responses exclude archived projects.

### Failures

| Status | Code | Condition |
|---:|---|---|
| 400 | `INVALID_PARAMETER` | Invalid project id or user id |
| 404 | `NOT_FOUND` | Project is missing or belongs to another user |
