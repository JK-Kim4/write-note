# Contract: Project Endpoints

**Date**: 2026-05-25
**Spec**: [../spec.md](../spec.md)
**SoT**: [docs/plan/03-backend-requirements.md §3-3 (#13~#19)](../../../docs/plan/03-backend-requirements.md)

본 spec 의 Project 7 endpoint request / response / error 매트릭스. 모든 응답은 001 도입 `Result<T>` envelope (`{ success: true, data: ... }` / `{ success: false, error: { code, message } }`). 모든 endpoint = JWT 인증 필수 (003 결선, FR-020).

---

## 공통

- Base path: `/api/projects`
- 인증: `Authorization: Bearer eyJ...` (JWT, 003 도입). 누락 / 무효 → 401 `AUTH_TOKEN_*`
- 응답 시간 형식: ISO 8601 (예: `2026-05-25T14:30:00Z`)
- 페이지네이션: `?page=0&size=20&sort=updatedAt,desc`. 최대 `size = 100`
- ownership: 본인 소유 외 리소스 접근 → 404 `RESOURCE_NOT_FOUND` (정보 노출 회피)

---

## #13 GET /api/projects

본인 프로젝트 목록 조회 (페이지네이션 + 필터).

### Query

| 파라미터 | 타입 | 필수 | 기본 | 설명 |
|---|---|---|---|---|
| `archived` | boolean | X | `false` | `false` = 활성 목록만 / `true` = 보관함만 |
| `page` | int | X | 0 | 0 부터 |
| `size` | int | X | 20 | 최대 100 |
| `sort` | string | X | `updatedAt,desc` | 허용 필드 = `updatedAt` / `createdAt` / `title` |

### Response 200

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 12,
        "title": "단막극 — 손녀",
        "genre": "치유물",
        "targetLength": 4000,
        "toneNotes": "잔잔, 회상",
        "synopsis": "...",
        "worldNotes": "...",
        "archivedAt": null,
        "createdAt": "2026-05-25T10:00:00Z",
        "updatedAt": "2026-05-25T14:30:00Z"
      }
    ],
    "totalElements": 1,
    "totalPages": 1,
    "page": 0,
    "size": 20
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `size > 100`, `sort` 잘못된 필드 |
| 401 | `AUTH_TOKEN_*` | 인증 누락 / 만료 |

### N+1 회피 (FR-019, SC-009)

본 endpoint 응답에 Character / Document 정보 미포함 (목록 카드에는 메타만). 추가 쿼리 0 회. 단, 향후 "프로젝트 카드에 인물 카운트" 등 surface 요구 시 별도 projection 으로 박음 (본 spec scope 외).

---

## #14 GET /api/projects/{id}

단건 조회.

### Path

- `id`: BIGINT

### Response 200

```json
{
  "success": true,
  "data": {
    "id": 12,
    "title": "단막극 — 손녀",
    "genre": "치유물",
    "targetLength": 4000,
    "toneNotes": "잔잔, 회상",
    "synopsis": "...",
    "worldNotes": "...",
    "archivedAt": null,
    "createdAt": "2026-05-25T10:00:00Z",
    "updatedAt": "2026-05-25T14:30:00Z"
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 존재하지 않음 / 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` | |

---

## #15 POST /api/projects

새 프로젝트 + 빈 본문 1:1 자동 생성 (FR-009/010, research R-3).

### Request

```json
{
  "title": "새 단막극",
  "genre": "치유물",
  "targetLength": 4000,
  "toneNotes": "잔잔",
  "synopsis": "...",
  "worldNotes": null
}
```

- `title`: 필수, `@NotBlank @Size(max = 120)`
- 나머지 5 필드: 선택 (모두 null 가능)

### Response 201

```json
{
  "success": true,
  "data": {
    "id": 13,
    "title": "새 단막극",
    "genre": "치유물",
    "targetLength": 4000,
    "toneNotes": "잔잔",
    "synopsis": "...",
    "worldNotes": null,
    "archivedAt": null,
    "createdAt": "2026-05-25T15:00:00Z",
    "updatedAt": "2026-05-25T15:00:00Z"
  }
}
```

같은 트랜잭션 안에서 documents 행 1:1 자동 생성 (`title=''`, body `{"type":"doc","content":[]}`, word_count=0). 단, 본 응답에는 documentId 미포함 — Week 3 본문 endpoint 진입 시 `GET /api/projects/{id}` 의 응답 확장으로 박음 가능 (본 spec scope 외).

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | title 누락 / 길이 초과 / targetLength 범위 초과 등 |
| 401 | `AUTH_TOKEN_*` | |
| 500 | `INTERNAL_SERVER_ERROR` | Document 자동 생성 실패 → Project 트랜잭션 롤백 (FR-010) |

---

## #16 PATCH /api/projects/{id}

메타 부분 수정 (FR-004 — null 필드는 미변경).

### Path

- `id`: BIGINT

### Request

```json
{
  "title": null,
  "genre": "스릴러",
  "targetLength": null,
  "toneNotes": "긴장, 빠른",
  "synopsis": null,
  "worldNotes": null
}
```

- 모든 필드 nullable. null = 미변경. 명시값 (빈 문자열 포함) = 갱신.
- `title` 이 명시되면 `@NotBlank @Size(max = 120)` 적용 — null 미명시 시 검증 skip.

### Response 200

```json
{
  "success": true,
  "data": {
    "id": 12,
    "title": "단막극 — 손녀",
    "genre": "스릴러",
    "targetLength": 4000,
    "toneNotes": "긴장, 빠른",
    "synopsis": "...",
    "worldNotes": "...",
    "archivedAt": null,
    "createdAt": "2026-05-25T10:00:00Z",
    "updatedAt": "2026-05-25T15:30:00Z"
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 명시된 필드의 검증 실패 |
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` | |

---

## #17 POST /api/projects/{id}/archive

보관 (archived_at = NOW()). 멱등 (이미 보관 상태 → 시각 유지).

### Path

- `id`: BIGINT

### Request

body 없음.

### Response 200

```json
{
  "success": true,
  "data": {
    "id": 12,
    "title": "단막극 — 손녀",
    ...
    "archivedAt": "2026-05-25T16:00:00Z",
    "createdAt": "...",
    "updatedAt": "2026-05-25T16:00:00Z"
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` | |

---

## #18 POST /api/projects/{id}/unarchive

보관 해제 (archived_at = NULL). 멱등 (이미 미보관 → no-op).

### Path / Request

`#17` 양식 동일 — body 없음.

### Response 200

`#17` 양식 + `archivedAt: null`.

### Errors

`#17` 양식 동일.

---

## #19 DELETE /api/projects/{id}

영구 삭제 — DB FK CASCADE 로 자식 (characters / documents) 자동 정리 (research R-5, FR-007/011).

### Path

- `id`: BIGINT

### Response 204

body 없음.

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 아님 |
| 401 | `AUTH_TOKEN_*` | |

### Cascade 영향 (본 spec 시점)

- characters: 모두 함께 사라짐 (DB FK CASCADE)
- documents: 1:1 행 사라짐 (DB FK CASCADE)
- SessionNote / MemoProject / MemoProjectCharacter (Week 4/5 entity 미존재) — 본 spec 시점에는 영향 없음. 신설 시점 (V6/V7 마이그레이션) 에 동일 FK CASCADE 박음 (research R-9)

---

## 호환성 — 003 의 5 endpoint → 본 spec 7 endpoint 확장

003 의 ProjectController = 5 endpoint (`createProject` / `listProjects` / `getProject` / `updateProject` / `archiveProject`). 본 spec 변경:

| 동작 | 003 시점 | 본 spec |
|---|---|---|
| 보관 | `archiveProject` (boolean toggle 가능성) | `#17 POST /archive` — 명시 액션 + `#18 POST /unarchive` 신설 |
| 영구 삭제 | 없음 | `#19 DELETE /api/projects/{id}` 신설 |
| 메타 부분 수정 | `updateProject` (title / archived 만 지원 추정) | `#16 PATCH` — 메타 5 필드 추가 (null = 미변경) |

본 spec 진입 시 003 의 `ProjectControllerIT` 와 `ProjectControllerOwnerCleanupTest` (5 케이스) 회귀 유지 + 본 spec 의 신규 endpoint 케이스 추가.
