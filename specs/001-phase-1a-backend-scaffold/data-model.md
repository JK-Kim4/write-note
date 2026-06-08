# Phase 1A Backend Foundation Data Model

## User

Represents the account owner for writing projects.

### Fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | Long | Yes | Server-generated primary identifier |
| `email` | String | Yes | Unique account email |
| `kakaoId` | String | No | Reserved for Week 1B Kakao OAuth linkage |
| `passwordHash` | String | No | Reserved for Week 1B email/password login |
| `createdAt` | Instant | Yes | Set by the database on insert |

### Validation

- `email` must be non-blank and unique.
- `email` length should fit common email limits and database index constraints.
- `kakaoId` may be null until OAuth is implemented.
- `passwordHash` may be null for social-login-only accounts.

### Relationships

- One `User` owns many `Project` records.

## Project

Represents the minimal writing workspace used to prove backend CRUD and ownership patterns.

### Fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | Long | Yes | Server-generated primary identifier |
| `userId` | Long | Yes | Owning user id |
| `title` | String | Yes | Minimal project display name |
| `archived` | Boolean | Yes | Defaults to false |
| `createdAt` | Instant | Yes | Set by the database on insert |
| `updatedAt` | Instant | Yes | Set on insert and update |

### Validation

- `title` must be non-blank.
- `title` should have a bounded maximum length.
- `userId` must reference an existing user.
- Archived projects are retained but excluded from active list responses.

### Relationships

- Many `Project` records belong to one `User`.
- Future Week 2 fields such as genre, target length, tone notes, synopsis, and world notes are intentionally excluded from Phase 1A.

### State Transitions

```text
active -> archived
active -> active with updated title
archived -> archived (idempotent archive)
```

Unarchive is out of scope for Phase 1A unless implementation naturally exposes it through a later update path; the required archive operation only moves active projects to archived state.

## Response Result

Represents the standard response envelope for all Phase 1A success and failure outcomes.

### Success Shape

| Field | Type | Required | Notes |
|---|---|---:|---|
| `success` | Boolean | Yes | `true` |
| `data` | Generic | Yes | Response payload |
| `error` | ErrorInfo | No | Always null on success |

### Failure Shape

| Field | Type | Required | Notes |
|---|---|---:|---|
| `success` | Boolean | Yes | `false` |
| `data` | Generic | No | Always null on failure |
| `error` | ErrorInfo | Yes | Stable code and readable message |

## ErrorInfo

| Field | Type | Required | Notes |
|---|---|---:|---|
| `code` | String | Yes | Stable machine-readable error code |
| `message` | String | Yes | Human-readable message |

### Error Codes

| Code | Meaning |
|---|---|
| `INVALID_PARAMETER` | Malformed request parameter |
| `VALIDATION_FAILED` | Request body or business validation failed |
| `NOT_FOUND` | Resource missing or not visible in current user context |
| `CONFLICT` | Duplicate or conflicting resource state |
| `INTERNAL_ERROR` | Unexpected server error |

## Page

Represents a bounded list response.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `content` | List | Yes | Page items |
| `page` | Int | Yes | Zero-based page index |
| `size` | Int | Yes | Requested page size after validation |
| `totalElements` | Long | Yes | Total matching records |
| `totalPages` | Int | Yes | Total pages for the query |

