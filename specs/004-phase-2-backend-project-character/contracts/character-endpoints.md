# Contract: Character Endpoints

**Date**: 2026-05-25
**Spec**: [../spec.md](../spec.md)
**SoT**: [docs/plan/03-backend-requirements.md §3-3 (#20~#25)](../../../docs/plan/03-backend-requirements.md)

본 spec 의 Character 6 endpoint (nested 경로). 모든 endpoint = JWT 인증 + *해당 Project 의 owner 가 현 사용자인지* 검증 (FR-015). 본인 소유 아닌 Project 의 인물 접근 시도 → 404 `RESOURCE_NOT_FOUND`.

---

## 공통

- Base path: `/api/projects/{projectId}/characters`
- `projectId` 검증: 본인 소유 아니거나 미존재 → 404 `RESOURCE_NOT_FOUND` (인물 자체 존재 여부 노출 회피)
- 인증 / 응답 envelope / 페이지네이션 규약은 [project-endpoints.md §공통](./project-endpoints.md#공통) 정합

---

## #20 GET /api/projects/{projectId}/characters

인물 목록 — 표시 순서 오름차순 + 동순위는 생성 순 (FR-013, research R-4).

### Path

- `projectId`: BIGINT

### Query

| 파라미터 | 타입 | 필수 | 기본 | 설명 |
|---|---|---|---|---|
| `page` | int | X | 0 | |
| `size` | int | X | 50 | 최대 100 (인물 ~5~10명 가정 — 한 페이지로 충분) |

### Response 200

```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": 101,
        "projectId": 12,
        "name": "민지",
        "shortDescription": "주인공, 22세 손녀",
        "notes": "회상에 능함...",
        "displayOrder": 0,
        "createdAt": "2026-05-25T11:00:00Z",
        "updatedAt": "2026-05-25T11:00:00Z"
      },
      {
        "id": 102,
        "projectId": 12,
        "name": "할머니",
        "shortDescription": "민지의 할머니",
        "notes": null,
        "displayOrder": 1,
        "createdAt": "2026-05-25T11:05:00Z",
        "updatedAt": "2026-05-25T11:05:00Z"
      }
    ],
    "totalElements": 2,
    "totalPages": 1,
    "page": 0,
    "size": 50
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 / 미존재 |
| 401 | `AUTH_TOKEN_*` | |

---

## #21 GET /api/projects/{projectId}/characters/{id}

단건 조회.

### Response 200

```json
{
  "success": true,
  "data": {
    "id": 101,
    "projectId": 12,
    "name": "민지",
    "shortDescription": "주인공, 22세 손녀",
    "notes": "회상에 능함...",
    "displayOrder": 0,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 / 인물 미존재 / 다른 프로젝트 인물 |

---

## #22 POST /api/projects/{projectId}/characters

새 인물.

### Request

```json
{
  "name": "민지",
  "shortDescription": "주인공, 22세 손녀",
  "notes": "회상에 능함...",
  "displayOrder": null
}
```

- `name`: 필수, `@NotBlank @Size(max = 80)`
- `shortDescription`: 선택, `@Size(max = 255)`
- `notes`: 선택, `@Size(max = 10000)`
- `displayOrder`: 선택, null → DB DEFAULT `0` (research R-4)

### Response 201

`#21` 양식 동일.

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | name 누락 / 길이 초과 |
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 |

---

## #23 PATCH /api/projects/{projectId}/characters/{id}

전체 상태 교체 (019 버그픽스 D 에서 시맨틱 변경): 콘텐츠 필드 (shortDescription / notes / age / gender / traits) 는
**요청의 null = 그 필드를 비움**. 클라이언트(편집 폼)는 항상 전 필드를 전송한다.
name (필수 — 비움 불가) / displayOrder (정렬은 #24 reorder 소관) 만 null = 미변경.

> 변경 이력: 당초 "null = 미변경" 부분 수정 규약이었으나, 폼이 비운 값(null)으로 필드를 클리어할 수 없는
> 버그(019 HANDOFF-bugfix §3-D)로 2026-06-12 사용자 컨펌 하에 전체 상태 교체로 변경.

### Request

```json
{
  "name": "민지",
  "shortDescription": "주인공, 24세로 갱신",
  "notes": null,
  "age": null,
  "gender": null,
  "traits": null,
  "displayOrder": null
}
```

### Response 200

`#21` 양식 동일.

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 명시된 필드의 검증 실패 |
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 / 인물 미존재 / 다른 프로젝트 인물 |

---

## #24 PUT /api/projects/{projectId}/characters/reorder

표시 순서 일괄 갱신 — 전체 인물 ID 의 새 순서를 전송 (FR-016, research R-4).

### Request

```json
{
  "characterIds": [102, 101, 103]
}
```

- `characterIds`: 해당 projectId 의 *모든 인물 ID 의 permutation* 의무
  - 누락 (전체 N 명 중 일부만 전송) → 400 `VALIDATION_FAILED`
  - 중복 (같은 ID 두 번) → 400 `VALIDATION_FAILED`
  - 외부 ID (다른 projectId 의 인물 ID) → 400 `VALIDATION_FAILED`
  - 빈 배열 (인물 0명 프로젝트) → 200 + no-op (Edge case)
- 검증 통과 후 — 첫 ID 의 `displayOrder = 0`, 두 번째 = 1, ... N-1 = N-1 로 단일 트랜잭션 갱신
- Component: `CharacterReorderValidator` 가 위 4 검증 박음 (plan.md 의 components 패키지)

### Response 200

```json
{
  "success": true,
  "data": {
    "content": [
      { "id": 102, "name": "할머니", "displayOrder": 0, ... },
      { "id": 101, "name": "민지", "displayOrder": 1, ... },
      { "id": 103, "name": "옆집 아저씨", "displayOrder": 2, ... }
    ],
    "totalElements": 3,
    "totalPages": 1,
    "page": 0,
    "size": 50
  }
}
```

(갱신 직후 목록 응답 — 클라이언트 별도 GET 호출 불필요)

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 누락 / 중복 / 외부 ID |
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 |

---

## #25 DELETE /api/projects/{projectId}/characters/{id}

삭제.

### Response 204

body 없음.

### Errors

| 상태 | code | 조건 |
|---|---|---|
| 404 | `RESOURCE_NOT_FOUND` | 본인 소유 projectId 아님 / 인물 미존재 / 다른 프로젝트 인물 |

### 후속 영향

- Memo (Week 4 entity 미구현) 의 `MemoProjectCharacter` 연결 정합은 본 spec 시점 영향 없음 — Week 4 진입 시 FK + cascade 박음
- display_order 빈자리: 인물 삭제 후 0/2/3 처럼 빈자리 발생 가능. reorder 호출 전까지 그대로 — 정렬 쿼리가 `display_order ASC, created_at ASC` 박혀있어 자연 정렬 (research R-4)

---

## 호환성

본 spec 진입 시점 = Character entity / endpoint 모두 신설. 003 회귀 영역 없음. 단, SecurityConfig 의 `/api/**` 매핑은 003 에서 박힘 → 본 spec endpoint 자동 보호 (FR-020).
